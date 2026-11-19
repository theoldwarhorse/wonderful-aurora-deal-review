"""Settings, all from environment variables so the same image runs anywhere."""

import os
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://aurora:aurora@localhost:5432/aurora")

# Uploaded and seeded PDFs. Mount a volume here or they are lost with the container.
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
DOCUMENTS_DIR = DATA_DIR / "documents"

# Where approved deals are pushed. Empty means nothing is configured and delivery fails visibly.
DOWNSTREAM_URL = os.environ.get("DOWNSTREAM_URL", "")

# Shared secret the extraction service must send. Empty disables the inbound endpoint.
EXTRACTION_TOKEN = os.environ.get("EXTRACTION_TOKEN", "")

# Shared secret AI agents must send to use the MCP server. Empty disables it.
MCP_TOKEN = os.environ.get("MCP_TOKEN", "")

# There is no sign-in, so nobody is named. Everything a person does is recorded under this job title.
REVIEWER_TITLE = os.environ.get("REVIEWER_TITLE", "Deal manager")

# Where people reach the app from outside the container. Only used to say so in the log at start-up.
PUBLIC_URL = os.environ.get("PUBLIC_URL", "http://localhost:8080")

# Enables POST /api/reset, which wipes everything back to the seed data.
DEMO_MODE = os.environ.get("DEMO_MODE", "") == "1"

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_UPLOAD_FILES = 20

# The sample deals and starting field list. In the image this is a copy of the repository's sample-data folder.
SEED_DIR = Path(os.environ.get("SEED_DIR", Path(__file__).resolve().parent.parent / "seed"))
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
