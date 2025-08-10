from fastapi import FastAPI,HTTPException
from pydantic import BaseModel

app = FastAPI()

class multimodel(BaseModel):
    a: int
    b: int


def multi(a:int,b:int):
    return a*b

@app.post("/multi")
def multi_numbers(model: multimodel):
    # Manual type check (even though Pydantic does it, this gives custom error message)
    if not isinstance(model.a, int) or not isinstance(model.b, int):
        raise HTTPException(status_code=400, detail="Both 'a' and 'b' must be integers.")
    
    return {"result": multi(model.a, model.b)}

# Example test
print(multi(3, 4))