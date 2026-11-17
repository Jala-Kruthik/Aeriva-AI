import os
import logging
from pathlib import Path
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("aeriva.database")

BASE_DIR = Path(__file__).resolve().parent.parent

# Persistent SQLite fallbacks (Render Persistent Disk mounted at /data or custom path)
RENDER_DISK_DIR = Path("/data")
SQLITE_OVERRIDE = os.getenv("SQLITE_DB_PATH", "").strip()

if SQLITE_OVERRIDE:
    DEFAULT_DB_FILE = Path(SQLITE_OVERRIDE)
elif RENDER_DISK_DIR.exists() and os.access(str(RENDER_DISK_DIR), os.W_OK):
    DEFAULT_DB_FILE = RENDER_DISK_DIR / "aeriva.db"
else:
    DEFAULT_DB_FILE = BASE_DIR / "database" / "aeriva.db"

DEFAULT_DB_FILE.parent.mkdir(parents=True, exist_ok=True)

# Support managed PostgreSQL (Render Postgres, Neon, Supabase) via DATABASE_URL
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///{DEFAULT_DB_FILE}"
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def run_migrations(target_engine=None):
    """
    Safe automatic migrations:
    1. Adds google_id column if not present.
    2. De-duplicates accounts sharing normalized email (keeping oldest, re-pointing child rows).
    3. Adds unique constraints/indexes on normalized email and google_id.
    """
    eng = target_engine or engine
    try:
        with eng.begin() as conn:
            insp = inspect(conn)
            tables = insp.get_table_names()
            if "users" not in tables:
                return

            cols = [c["name"] for c in insp.get_columns("users")]

            # 1. Add google_id column if missing
            if "google_id" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN google_id VARCHAR;"))
                logger.info("Migrated: Added google_id column to users table.")

            # 2. De-duplicate users by normalized email
            user_rows = conn.execute(
                text("SELECT id, email FROM users ORDER BY id ASC;")
            ).fetchall()

            seen_emails = {}
            for uid, raw_email in user_rows:
                if not raw_email:
                    continue
                norm_email = raw_email.strip().lower()
                if norm_email not in seen_emails:
                    seen_emails[norm_email] = uid
                else:
                    canonical_id = seen_emails[norm_email]
                    dup_id = uid
                    # Re-point child rows from duplicate to canonical user
                    if "daily_schedules" in tables:
                        conn.execute(text(
                            f"UPDATE daily_schedules SET user_id = {canonical_id} WHERE user_id = {dup_id};"
                        ))
                    if "food_logs" in tables:
                        conn.execute(text(
                            f"UPDATE food_logs SET user_id = {canonical_id} WHERE user_id = {dup_id};"
                        ))
                    conn.execute(text(
                        f"DELETE FROM users WHERE id = {dup_id};"
                    ))
                    logger.info(f"De-duplicated: Merged duplicate user id {dup_id} into canonical id {canonical_id} ({norm_email}).")

            # 3. Create unique indexes if not present
            is_sqlite = "sqlite" in str(eng.url)
            try:
                if is_sqlite:
                    conn.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;"
                    ))
                else:
                    conn.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id);"
                    ))
            except Exception as e:
                logger.debug(f"Index ix_users_google_id check: {e}")

            try:
                conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);"
                ))
            except Exception as e:
                logger.debug(f"Index ix_users_email check: {e}")

    except Exception as e:
        logger.warning(f"Database migration notice: {e}")


# Run migrations on startup
try:
    run_migrations()
except Exception as _mig_err:
    pass

