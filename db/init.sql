-- Script executado automaticamente pelo Postgres na primeira subida do container
-- (mapeado em /docker-entrypoint-initdb.d dentro do container).

-- Usuários do sistema. Cada usuário só enxerga o próprio cofre de senhas.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Itens do cofre. A senha nunca é gravada em texto puro: fica criptografada
-- com AES-256-GCM (iv e auth_tag são necessários para descriptografar depois).
CREATE TABLE IF NOT EXISTS vault_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_title VARCHAR(255) NOT NULL,
    service_username VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    iv VARCHAR(255) NOT NULL,
    auth_tag VARCHAR(255) NOT NULL,
    url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Trilha de auditoria: registrada pelo worker-audit a partir das mensagens
-- publicadas na fila "audit-log" do RabbitMQ, para toda operação no cofre.
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
