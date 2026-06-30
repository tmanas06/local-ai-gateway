from fastapi import FastAPI
import requests

app = FastAPI()


@app.get("/")
def home():
    return {"message": "AI Server is running!"}


@app.post("/chat")
def chat(prompt: str):
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "gemma3:4b",
            "prompt": prompt,
            "stream": False
        }
    )

    data = response.json()

    return {
        "response": data["response"]
    }
