CREATE TABLE IF NOT EXISTS movie_cast (
    movie_id INT NOT NULL,
    person_id BIGINT UNSIGNED NOT NULL,
    character VARCHAR(255),
    cast_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (movie_id, person_id),
    KEY idx_movie_cast_order (movie_id, cast_order),
    CONSTRAINT fk_movie_cast_movie FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE CASCADE,
    CONSTRAINT fk_movie_cast_person FOREIGN KEY (person_id) REFERENCES people (id) ON DELETE CASCADE
);
