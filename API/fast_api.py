from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


@app.get("/amarendra/kumar/xyz")
def add(a:int,b:int):
    return a+b



class subtractmodel(BaseModel):
    a: int
    b: int


def subtract(a:int,b:int):
    return a-b

@app.post("/subtract")
def subtract_numbers(model: subtractmodel):
    return subtract(model.a, model.b)

print(add(3,4))

