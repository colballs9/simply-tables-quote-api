"""
Simply Tables Quote System — API Server

FastAPI application with auto-recalculating quote engine.

Run locally:
    uvicorn app.main:app --reload --port 8080

Deploy to Cloud Run:
    gcloud run deploy quote-api --source . --region us-central1
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import quotes, products, cost_blocks, labor_blocks, group_pools, catalog


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run migrations and init database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Simply Tables Quote API",
    description="Private quoting tool for Simply Tables custom furniture manufacturing.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow React frontend (dev + production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",        # React dev server
        "http://localhost:5173",        # Vite dev server
        "https://quote.simplytables.com",  # future production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(quotes.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(cost_blocks.router, prefix="/api")
app.include_router(labor_blocks.router, prefix="/api")
app.include_router(group_pools.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")


@app.get("/")
async def root():
    return {"status": "Simply Tables Quote API running", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
