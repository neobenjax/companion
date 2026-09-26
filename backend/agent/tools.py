import re
from typing import Dict, Any

def execute_math(expression: str) -> Dict[str, Any]:
    expr = expression.replace("x", "*").replace("X", "*").replace("×", "*").replace("÷", "/")
    # Only allow safe mathematical characters
    if not re.match(r"^[\d\s\+\-\*\/\(\)\.\%]+$", expr):
        return {"error": "Invalid mathematical expression"}
    try:
        # Evaluate safely
        res = eval(expr, {"__builtins__": None}, {})
        return {"result": res, "expression": expr}
    except Exception as e:
        return {"error": str(e)}

def execute_tool(tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
    if tool_name == "calculator":
        expr = params.get("expression", "")
        return execute_math(expr)
    elif tool_name == "web_search":
        query = params.get("query", "")
        return {"result": f"Searched web for: '{query}'.", "status": "executed"}
    elif tool_name == "save_todo":
        task = params.get("task", "")
        return {"result": f"Saved task: '{task}'", "status": "executed"}
    else:
        return {"result": f"Executed {tool_name}", "params": params}
