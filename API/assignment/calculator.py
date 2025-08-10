from fastapi import FastAPI, HTTPException
from pydantic import BaseModel  

app = FastAPI()


class CalculatorInput(BaseModel):
    num1: float
    num2: float
    operation: str  # add, subtract, multiply, divide


@app.post("/calculator")
def calculator(input_data: CalculatorInput):
    num1 = input_data.num1
    num2 = input_data.num2
    operation = input_data.operation.lower()

      # Manual type check (even though Pydantic does it, this gives custom error message)
    if not isinstance(input_data.num1, int) or not isinstance(input_data.num1, float):
        raise HTTPException(status_code=400, detail="Both 'num1' and 'num2' must be float.")

    if operation == "add":
        result = num1 + num2
    elif operation == "subtract":
        result = num1 - num2
    elif operation == "multiply":
        result = num1 * num2
    elif operation == "divide":
        if num2 == 0:
            raise HTTPException(status_code=400, detail="Division by zero is not allowed.")
        result = num1 / num2
    else:
        raise HTTPException(status_code=400, detail="Invalid operation. Use add, subtract, multiply, or divide.")

    return {"result": result}
