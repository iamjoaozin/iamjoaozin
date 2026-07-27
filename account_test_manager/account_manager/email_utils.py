import random
import string


def random_gmail(prefix: str = "teste") -> str:
    alphabet = string.ascii_lowercase + string.digits
    token = "".join(random.choice(alphabet) for _ in range(12))
    return f"{prefix}.{token}@gmail.com"
