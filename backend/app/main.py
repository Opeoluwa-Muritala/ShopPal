from fastapi import FastAPI

app = FastAPI(title="Naija Marketplace API")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
