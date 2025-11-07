INSERT INTO users (name, email, password_hash, created_at, updated_at)
VALUES (
    '개발자 모드',
    'root@dev.local',
    SHA2('root', 256),
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    password_hash = VALUES(password_hash),
    updated_at = NOW();
