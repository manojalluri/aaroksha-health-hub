
-- OP SLOT BOOKING HARDENING
-- This script adds slot capacity management to doctors.

-- 1. Add slot_capacity to doctors table
ALTER TABLE doctors 
  ADD COLUMN IF NOT EXISTS slot_capacity INTEGER DEFAULT 10;

-- 2. Create a helper function to check slot availability
CREATE OR REPLACE FUNCTION check_slot_availability(
    target_doctor_id UUID,
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
        d.slot_capacity as max_capacity,
        (COUNT(*) < d.slot_capacity) as is_available
    FROM doctors d
    LEFT JOIN appointments a ON a.doctor_id = d.id 
        AND a.appointment_date = target_date 
        AND a.appointment_time = target_time
        AND a.status IN ('pending', 'confirmed')
    WHERE d.id = target_doctor_id
    GROUP BY d.id, d.slot_capacity;
END;
$$ LANGUAGE plpgsql;

-- 3. Atomic Booking RPC
CREATE OR REPLACE FUNCTION book_op_appointment(
    p_order_id TEXT,
    p_user_id UUID,
    p_doctor_id UUID,
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
    -- 1. Check current capacity
    SELECT slot_capacity INTO v_capacity FROM doctors WHERE id = p_doctor_id;
    
    SELECT COUNT(*) INTO v_booked_count 
    FROM appointments 
    WHERE doctor_id = p_doctor_id 
      AND appointment_date = p_appointment_date 
      AND appointment_time = p_appointment_time
      AND status IN ('pending', 'confirmed');

    -- 2. Check if user already booked this slot
    SELECT EXISTS (
        SELECT 1 FROM appointments 
        WHERE doctor_id = p_doctor_id 
          AND user_id = p_user_id
          AND appointment_date = p_appointment_date 
          AND appointment_time = p_appointment_time
          AND status IN ('pending', 'confirmed')
    ) INTO v_is_already_booked;

    IF v_is_already_booked THEN
        RETURN jsonb_build_object('success', false, 'message', 'ALREADY_BOOKED');
    END IF;

    IF v_booked_count >= v_capacity THEN
        RETURN jsonb_build_object('success', false, 'message', 'SLOT_FULL');
    END IF;

    -- 3. Insert appointment
    INSERT INTO appointments (
        order_id, user_id, doctor_id, doctor_name, 
        patient_name, patient_phone, patient_email, patient_age, patient_gender, patient_town,
        notes, appointment_date, appointment_time, fee, consultation_fee, platform_fee,
        is_priority, hospital_partner_id, status, verification_code
    ) VALUES (
        p_order_id, p_user_id, p_doctor_id, p_doctor_name,
        p_patient_name, p_patient_phone, p_patient_email, p_patient_age, p_patient_gender, p_patient_town,
        p_notes, p_appointment_date, p_appointment_time, p_fee, p_consultation_fee, p_platform_fee,
        p_is_priority, p_hospital_partner_id, 'pending', p_verification_code
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 4. Audit Log
INSERT INTO audit_logs (action, entity_type, details)
VALUES ('SCHEMA_UPGRADE', 'doctors', '{"msg": "Slot capacity management added to OP booking system."}');
