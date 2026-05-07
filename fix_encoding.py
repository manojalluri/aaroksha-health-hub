import codecs

path = 'c:\\Users\\manoj\\Desktop\\aaroksha-health-hub\\src\\pages\\admin\\HospitalDashboard.tsx'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace('â‚¹', '₹')
content = content.replace('â€”', '—')
content = content.replace('Â·', '·')
content = content.replace('â• ', '═')
content = content.replace('ðŸ“…', '📅')
content = content.replace('ðŸ• ', '🕒')

content = content.replace('viewAppt.status === "confirmed" && viewAppt.verification_code && (', 'viewAppt.status === "confirmed" && (')

content = content.replace('if (viewAppt.status === "confirmed" && viewAppt.verification_code && verificationCodeInput !== viewAppt.verification_code)', 'if (viewAppt.status === "confirmed" && verificationCodeInput !== (viewAppt.verification_code || ""))')

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
