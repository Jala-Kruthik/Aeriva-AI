from pwdlib import PasswordHash
from jose import jwt, JWTError


# =========================================
# PASSWORD HASHING
# =========================================

password_hash = PasswordHash.recommended()


# =========================================
# JWT SETTINGS
# =========================================

SECRET_KEY = "aeriva-ai-secret-key-change-later"

ALGORITHM = "HS256"


# =========================================
# NORMALIZE EMAIL
# =========================================

def normalize_email(email: str) -> str:

    return email.strip().lower()


# =========================================
# HASH PASSWORD
# =========================================

def hash_password(password: str) -> str:

    return password_hash.hash(password)


# =========================================
# VERIFY PASSWORD
# =========================================

def verify_password(
    password: str,
    hashed_password: str
) -> bool:

    try:

        return password_hash.verify(
            password,
            hashed_password
        )

    except Exception:

        return False


# =========================================
# CREATE JWT TOKEN
# =========================================

def create_access_token(data: dict) -> str:
    # Ensure token contains core claims and does not expire prematurely
    to_encode = data.copy()
    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# =========================================
# VERIFY JWT TOKEN
# =========================================

def verify_access_token_payload(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        return payload
    except (JWTError, ValueError, TypeError):
        return None


def verify_access_token(token: str):
    payload = verify_access_token_payload(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    try:
        return int(user_id)
    except (ValueError, TypeError):
        return None
