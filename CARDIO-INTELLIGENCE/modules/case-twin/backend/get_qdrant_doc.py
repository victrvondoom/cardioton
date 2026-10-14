import os
import json
from qdrant_client import QdrantClient

# Configure your own Qdrant instance for this optional live inspection script.
QDRANT_URL = os.environ["QDRANT_URL"]
QDRANT_API_KEY = os.environ["QDRANT_API_KEY"]

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

try:
    results, _ = client.scroll(
        collection_name="chest_xrays",
        limit=1,
        with_payload=True,
        with_vectors=False
    )
    if results:
        print(json.dumps(results[0].payload, indent=2))
    else:
        print("No results found.")
except Exception as e:
    print(f"Error: {e}")
