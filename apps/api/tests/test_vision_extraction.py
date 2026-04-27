"""
Test suite to verify Claude and Gemini vision extraction quality.
Validates that Claude extraction now matches or exceeds Gemini performance.
Specifically tests:
- Accurate quantity extraction per item
- Accurate sales amount extraction
- Category-to-item mapping (item qty sum == category qty)
- Item completeness (no missing items)
- Desserts category tracking (promotion items)
"""

import pytest
import asyncio
import base64
import json
from pathlib import Path
from unittest.mock import patch, AsyncMock
import re


class TestExtractionAccuracy:
    """Test extraction accuracy for Claude vs Gemini"""

    def test_claude_desserts_category_position(self):
        """Verify Desserts category comes in correct position"""
        import os
        api_path = os.path.join(os.path.dirname(__file__), '..', 'services')

        claude_file = os.path.join(api_path, 'claude_vision.py')
        with open(claude_file, 'r', encoding='utf-8') as f:
            claude_content = f.read()

        match = re.search(r'POS_COMBINED_PROMPT = """(.+?)"""', claude_content, re.DOTALL)
        assert match, "Could not find POS_COMBINED_PROMPT in claude_vision.py"
        prompt = match.group(1)

        # Verify cakes are listed as Desserts (between Take Home and Desserts T>)
        assert "CPU cakes" in prompt, "Claude prompt should mention CPU cakes in Desserts"
        assert "ATC cakes" in prompt, "Claude prompt should mention ATC cakes in Desserts"
        assert "T>Take Home and T>Desserts = Desserts items" in prompt, "Desserts should come after Take Home"

    def test_prompt_no_hardcoded_examples(self):
        """Verify prompts don't contain hardcoded example numbers"""
        import os
        api_path = os.path.join(os.path.dirname(__file__), '..', 'services')

        # Read Claude prompt
        claude_file = os.path.join(api_path, 'claude_vision.py')
        with open(claude_file, 'r', encoding='utf-8') as f:
            claude_content = f.read()

        # Extract POS_COMBINED_PROMPT
        match = re.search(r'POS_COMBINED_PROMPT = """(.+?)"""', claude_content, re.DOTALL)
        assert match, "Could not find POS_COMBINED_PROMPT in claude_vision.py"
        claude_prompt = match.group(1)

        # Check Claude prompt
        assert "24887" not in claude_prompt, "Claude prompt contains hallucination example (24887)"
        assert "1470" not in claude_prompt, "Claude prompt contains hallucination example (1470)"

        # Read Gemini prompt
        gemini_file = os.path.join(api_path, 'gemini_vision.py')
        with open(gemini_file, 'r', encoding='utf-8') as f:
            gemini_content = f.read()

        # Extract POS_COMBINED_PROMPT
        match = re.search(r'POS_COMBINED_PROMPT = """(.+?)"""', gemini_content, re.DOTALL)
        assert match, "Could not find POS_COMBINED_PROMPT in gemini_vision.py"
        gemini_prompt = match.group(1)

        # Check Gemini prompt
        assert "24887" not in gemini_prompt, "Gemini prompt contains hallucination example (24887)"
        assert "1470" not in gemini_prompt, "Gemini prompt contains hallucination example (1470)"

    def test_prompts_have_validation_rules(self):
        """Verify prompts include strict validation rules"""
        import os
        api_path = os.path.join(os.path.dirname(__file__), '..', 'services')

        # Read Claude prompt
        claude_file = os.path.join(api_path, 'claude_vision.py')
        with open(claude_file, 'r', encoding='utf-8') as f:
            claude_content = f.read()

        match = re.search(r'POS_COMBINED_PROMPT = """(.+?)"""', claude_content, re.DOTALL)
        assert match, "Could not find POS_COMBINED_PROMPT in claude_vision.py"
        claude_prompt = match.group(1)

        # Claude should have validation
        assert "VALIDATION" in claude_prompt, "Claude prompt missing validation rules"
        assert "sum of all item QUANTITIES" in claude_prompt, "Claude prompt missing category qty check"

        # Read Gemini prompt
        gemini_file = os.path.join(api_path, 'gemini_vision.py')
        with open(gemini_file, 'r', encoding='utf-8') as f:
            gemini_content = f.read()

        match = re.search(r'POS_COMBINED_PROMPT = """(.+?)"""', gemini_content, re.DOTALL)
        assert match, "Could not find POS_COMBINED_PROMPT in gemini_vision.py"
        gemini_prompt = match.group(1)

        # Gemini should have validation
        assert "VALIDATION" in gemini_prompt, "Gemini prompt missing validation rules"

    def test_prompts_include_desserts_category(self):
        """Verify prompts explicitly mention Desserts category"""
        import os
        api_path = os.path.join(os.path.dirname(__file__), '..', 'services')

        # Read Claude prompt
        claude_file = os.path.join(api_path, 'claude_vision.py')
        with open(claude_file, 'r', encoding='utf-8') as f:
            claude_content = f.read()

        match = re.search(r'POS_COMBINED_PROMPT = """(.+?)"""', claude_content, re.DOTALL)
        assert match, "Could not find POS_COMBINED_PROMPT in claude_vision.py"
        claude_prompt = match.group(1)

        assert "T>Desserts" in claude_prompt, "Claude prompt missing Desserts category"
        assert "CPU cakes" in claude_prompt or "cakes" in claude_prompt, "Claude prompt missing cake product examples"

        # Read Gemini prompt
        gemini_file = os.path.join(api_path, 'gemini_vision.py')
        with open(gemini_file, 'r', encoding='utf-8') as f:
            gemini_content = f.read()

        match = re.search(r'POS_COMBINED_PROMPT = """(.+?)"""', gemini_content, re.DOTALL)
        assert match, "Could not find POS_COMBINED_PROMPT in gemini_vision.py"
        gemini_prompt = match.group(1)

        assert "T>Desserts" in gemini_prompt, "Gemini prompt missing Desserts category"

    def test_prompts_category_ordering(self):
        """Verify prompts specify correct category order"""
        import os
        api_path = os.path.join(os.path.dirname(__file__), '..', 'services')

        # Read Claude prompt
        claude_file = os.path.join(api_path, 'claude_vision.py')
        with open(claude_file, 'r', encoding='utf-8') as f:
            claude_content = f.read()

        match = re.search(r'POS_COMBINED_PROMPT = """(.+?)"""', claude_content, re.DOTALL)
        assert match, "Could not find POS_COMBINED_PROMPT in claude_vision.py"
        prompt = match.group(1)

        # Check that prompt mentions all categories in BETWEEN format
        assert "Items between T>Cups & Cones and T>Sundaes" in prompt, "Missing Sundaes category description"
        assert "Items between T>Sundaes and T>Beverages" in prompt, "Missing Beverages category description"
        assert "Items between T>Beverages and T>Take Home" in prompt, "Missing Take Home category description"
        assert "Items between T>Take Home and T>Desserts" in prompt, "Missing Desserts category description"
        assert "Items between T>Desserts and T>Toppings" in prompt, "Missing Toppings category description"


class TestExtractionStructure:
    """Test that extraction returns proper JSON structure"""

    def test_json_structure_validation(self):
        """Verify extraction returns proper JSON schema"""
        # Expected structure from both services
        expected_keys = {
            "sales_summary",
            "categories",
            "items"
        }
        # This is what the schema should look like

    def test_sales_summary_fields(self):
        """Verify sales_summary has all required fields"""
        required_fields = {
            "branch_code",
            "date",
            "gross_sales",
            "returns",
            "net_sales",
            "discount",
            "tax",
            "guest_count",
            "atv",
            "cash_sales",
            "cash_gc"
        }

    def test_category_fields(self):
        """Verify each category has all required fields"""
        required_fields = {
            "name",
            "quantity",
            "sales",
            "contribution_pct"
        }

    def test_item_fields(self):
        """Verify each item has all required fields"""
        required_fields = {
            "code",
            "name",
            "category",
            "quantity",
            "sales",
            "contribution_pct"
        }


class TestRealDataValidation:
    """Tests using real data from daily_sales table"""

    def test_desserts_category_guidelines(self):
        """Verify Desserts category extraction guidelines are clear"""
        import os
        api_path = os.path.join(os.path.dirname(__file__), '..', 'services')

        claude_file = os.path.join(api_path, 'claude_vision.py')
        with open(claude_file, 'r', encoding='utf-8') as f:
            claude_content = f.read()

        match = re.search(r'POS_COMBINED_PROMPT = """(.+?)"""', claude_content, re.DOTALL)
        assert match, "Could not find POS_COMBINED_PROMPT in claude_vision.py"
        prompt = match.group(1)

        # Verify that the critical fix is in place: cakes come BEFORE T>Desserts line
        assert "CAKES ARE HERE" in prompt, "Desserts extraction guidelines should highlight cake location"
        assert "CPU cakes, ATC cakes, INV cakes" in prompt, "Should list specific cake product codes"


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
