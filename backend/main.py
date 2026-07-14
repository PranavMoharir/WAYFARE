from fastapi import FastAPI

app = FastAPI(title="Wayfare Backend")

@app.get("/")
def root():
    return {
        "message": "Backend is running!"
    }
    