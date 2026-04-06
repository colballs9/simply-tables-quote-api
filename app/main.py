"""
Simply Tables Quote System — API Server

FastAPI application with auto-recalculating quote engine.

Run locally:
    uvicorn app.main:app --reload --port 8080

Deploy to Cloud Run:
    gcloud run deploy quote-api --source . --region us-central1
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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
        "http://localhost:8000",        # local static file server
        "http://127.0.0.1:8000",        # local static file server
        "null",                         # file:// origin for local HTML dev
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


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve built React frontend — must come AFTER all API routes
_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets")), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(_dist, "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Catch-all: serve index.html for client-side routing."""
        file_path = os.path.join(_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_dist, "index.html"))
else:
    @app.get("/")
    async def root():
        return {"status": "Simply Tables Quote API running", "version": "0.1.0"}
