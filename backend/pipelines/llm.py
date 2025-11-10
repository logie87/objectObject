import ollama


def run_llm(prompt: str, model: str = "phi3") -> str:
    """
    Use ollama Python client if installed. API may change; this is a best-effort wrapper.
    """
    response = ollama.chat(
        model=model,
        messages=[
            {
                "role": "user",
                "content": prompt,
            },
        ],
    )
    # ensure it's string
    # print(response)

    return response.message.content
