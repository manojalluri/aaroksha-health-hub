
-- OP BOOKING TYPE-MISMATCH FINAL FIX
-- Resolves "operator does not exist: text = uuid" errors in OP Booking flow.

-- 1. Hardened Slot Availability Check
CREATE OR REPLACE FUNCTION check_slot_availability(
    target_doctor_id TEXT, 
    target_date DATE,
    target_time TEXT
)
RETURNS TABLE (
    booked_count BIGINT,
    max_capacity INTEGER,
    is_available BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as booked_count,
        COALESCE(d.slot_capacity, 10) as max_capacity,
        (COUNT(*) < COALESCE(d.slot_capacity, 10)) as is_available
    FROM doctors d
    LEFT JOIN appointments a ON (a.doctor_id::TEXT = d.id::TEXT) -- Robust comparison
        AND (a.appointment_date::TEXT = target_date::TEXT)
        AND (a.appointment_time::TEXT = target_time::TEXT)
        AND a.status IN ('pending', 'confirmed')
    WHERE d.id::TEXT = target_doctor_id::TEXT
    GROUP BY d.id, d.slot_capacity;
END;
$$ LANGUAGE plpgsql;

-- 2. Atomic & Type-Safe Booking RPC
CREATE OR REPLACE FUNCTION book_op_appointment(
    p_order_id TEXT,
    p_user_id TEXT,
    p_doctor_id TEXT,
    p_doctor_name TEXT,
    p_patient_name TEXT,
    p_patient_phone TEXT,
    p_patient_email TEXT,
    p_patient_age TEXT,
    p_patient_gender TEXT,
    p_patient_town TEXT,
    p_notes TEXT,
    p_appointment_date DATE,
    p_appointment_time TEXT,
    p_fee NUMERIC,
    p_consultation_fee NUMERIC,
    p_platform_fee NUMERIC,
    p_is_priority BOOLEAN,
    p_hospital_partner_id TEXT,
    p_verification_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_capacity INTEGER;
    v_booked_count BIGINT;
    v_is_already_booked BOOLEAN;
BEGIN
    -- 1. Fetch capacity with TEXT casting to avoid UUID mismatch
    SELECT COALESCE(slot_capacity, 10) INTO v_capacity 
    FROM doctors 
    WHERE id::TEXT = p_doctor_id::TEXT;
    
    IF v_capacity IS NULL THEN v_capacity := 10; END IF;

    -- 2. Count existing bookings
    SELECT COUNT(*) INTO v_booked_count 
    FROM appointments 
    WHERE doctor_id::TEXT = p_doctor_id::TEXT 
      AND appointment_date::TEXT = p_appointment_date::TEXT
      AND appointment_time::TEXT = p_appointment_time::TEXT
      AND status IN ('pending', 'confirmed');

    -- 3. Check for duplicate user booking
    SELECT EXISTS (
        SELECT 1 FROM appointments 
        WHERE doctor_id::TEXT = p_doctor_id::TEXT 
          AND user_id::TEXT = p_user_id::TEXT
          AND appointment_date::TEXT = p_appointment_date::TEXT 
          AND appointment_time::TEXT = p_appointment_time::TEXT
          AND status IN ('pending', 'confirmed')
    ) INTO v_is_already_booked;

    IF v_is_already_booked THEN
        RETURN jsonb_build_object('success', false, 'message', 'ALREADY_BOOKED');
    END IF;

    IF v_booked_count >= v_capacity THEN
        RETURN jsonb_build_object('success', false, 'message', 'SLOT_FULL');
    END IF;

    -- 4. Atomic Insertion
    INSERT INTO appointments (
        order_id, user_id, doctor_id, doctor_name, 
        patient_name, patient_phone, patient_email, patient_age, patient_gender, patient_town,
        notes, appointment_date, appointment_time, fee, consultation_fee, platform_fee,
        is_priority, hospital_partner_id, status, verification_code
    ) VALUES (
        p_order_id, 
        CASE WHEN (p_user_id IS NOT NULL AND p_user_id ~ '^[0-9a-fA-F-]{36}$') THEN p_user_id::UUID ELSE NULL END,
        CASE WHEN (p_doctor_id IS NOT NULL AND p_doctor_id ~ '^[0-9a-fA-F-]{36}$') THEN p_doctor_id::UUID ELSE NULL END,
        p_doctor_name,
        p_patient_name, p_patient_phone, p_patient_email, p_patient_age, p_patient_gender, p_patient_town,
        p_notes, p_appointment_date::TEXT, p_appointment_time, p_fee, p_consultation_fee, p_platform_fee,
        p_is_priority, p_hospital_partner_id, 'pending', p_verification_code
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Audit trail
INSERT INTO audit_logs (action, entity_type, details)
VALUES ('TYPE_HARDENING', 'appointments', '{"msg": "OP booking type mismatch fixed with TEXT=UUID casting."}');
