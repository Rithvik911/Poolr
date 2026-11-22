# Benchmark data

The under-the-hood page reads `manifest.json` from this folder. It does not ship with sample numbers.

Accepted shape:

```json
{
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "series": [
    {
      "title": "Search latency",
      "unit": "ms",
      "points": [
        { "label": "variant name", "value": 0 }
      ]
    }
  ]
}
```

Only add values produced by an actual benchmark run. The page displays the values as supplied and does not infer or fill missing results.
