from fastapi import FastAPI
from pydantic import BaseModel, EmailStr, Field
from typing import List

app = FastAPI()

# In-memory storage
registered_users = []

# Request Model
class UserRegistration(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(..., min_length=8)  # at least 8 characters

@app.post("/register")
def register_user(user: UserRegistration):
    # Store in memory
    registered_users.append(user.dict())
    return {"message": "User registered successfully!"}

@app.get("/users", response_model=List[UserRegistration])
def get_registered_users():
    return registered_users
