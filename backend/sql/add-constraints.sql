-- Add missing foreign keys and unique constraints to enforce referential integrity.

-- Drop & recreate constraints to make the script idempotent.

-- movie_genres
ALTER TABLE movie_genres DROP FOREIGN KEY IF EXISTS fk_movie_genres_movie;
ALTER TABLE movie_genres DROP FOREIGN KEY IF EXISTS fk_movie_genres_genre;
ALTER TABLE movie_genres ADD CONSTRAINT fk_movie_genres_movie
    FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE CASCADE;
ALTER TABLE movie_genres ADD CONSTRAINT fk_movie_genres_genre
    FOREIGN KEY (genre_id) REFERENCES genres (id) ON DELETE CASCADE;

-- movie_streaming_platforms
ALTER TABLE movie_streaming_platforms DROP FOREIGN KEY IF EXISTS fk_movie_streams_movie;
ALTER TABLE movie_streaming_platforms DROP FOREIGN KEY IF EXISTS fk_movie_streams_platform;
ALTER TABLE movie_streaming_platforms DROP FOREIGN KEY IF EXISTS fk_msp_movie;
ALTER TABLE movie_streaming_platforms DROP FOREIGN KEY IF EXISTS fk_msp_platform;
ALTER TABLE movie_streaming_platforms ADD CONSTRAINT fk_movie_streams_movie
    FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE CASCADE;
ALTER TABLE movie_streaming_platforms ADD CONSTRAINT fk_movie_streams_platform
    FOREIGN KEY (platform_id) REFERENCES streaming_platforms (id) ON DELETE CASCADE;

-- movie_cast
ALTER TABLE movie_cast DROP FOREIGN KEY IF EXISTS fk_movie_cast_movie;
ALTER TABLE movie_cast DROP FOREIGN KEY IF EXISTS fk_movie_cast_person;
ALTER TABLE movie_cast ADD CONSTRAINT fk_movie_cast_movie
    FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE CASCADE;
ALTER TABLE movie_cast ADD CONSTRAINT fk_movie_cast_person
    FOREIGN KEY (person_id) REFERENCES people (id) ON DELETE CASCADE;

-- likes
ALTER TABLE likes DROP FOREIGN KEY IF EXISTS fk_likes_user;
ALTER TABLE likes DROP FOREIGN KEY IF EXISTS fk_likes_movie;
ALTER TABLE likes ADD CONSTRAINT fk_likes_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE likes ADD CONSTRAINT fk_likes_movie
    FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE CASCADE;

-- user_preferred_genres
ALTER TABLE user_preferred_genres DROP FOREIGN KEY IF EXISTS fk_user_pref_user;
ALTER TABLE user_preferred_genres DROP FOREIGN KEY IF EXISTS fk_user_pref_genre;
ALTER TABLE user_preferred_genres DROP FOREIGN KEY IF EXISTS fk_upg_user;
ALTER TABLE user_preferred_genres DROP FOREIGN KEY IF EXISTS fk_upg_genre;
ALTER TABLE user_preferred_genres ADD CONSTRAINT fk_user_pref_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE user_preferred_genres ADD CONSTRAINT fk_user_pref_genre
    FOREIGN KEY (genre_id) REFERENCES genres (id) ON DELETE CASCADE;

-- review_reports
ALTER TABLE review_reports DROP FOREIGN KEY IF EXISTS fk_review_reports_review;
ALTER TABLE review_reports DROP FOREIGN KEY IF EXISTS fk_review_reports_user;
ALTER TABLE review_reports DROP FOREIGN KEY IF EXISTS fk_rr_review;
ALTER TABLE review_reports DROP FOREIGN KEY IF EXISTS fk_rr_user;
ALTER TABLE review_reports DROP INDEX IF EXISTS uniq_review_reports_review_user;
ALTER TABLE review_reports ADD CONSTRAINT fk_review_reports_review
    FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE;
ALTER TABLE review_reports ADD CONSTRAINT fk_review_reports_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE review_reports ADD CONSTRAINT uniq_review_reports_review_user
    UNIQUE KEY (review_id, user_id);


CREATE TABLE movie_directors (
    movie_id  BIGINT UNSIGNED NOT NULL,
    person_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (movie_id, person_id),
    FOREIGN KEY (movie_id)   REFERENCES movies(id)    ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);
