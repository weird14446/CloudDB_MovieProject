CREATE TABLE IF NOT EXISTS user_preferred_genres (
    user_id INT NOT NULL,
    genre_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, genre_id),
    CONSTRAINT fk_upg_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_upg_genre FOREIGN KEY (genre_id) REFERENCES genres (id) ON DELETE CASCADE
);
