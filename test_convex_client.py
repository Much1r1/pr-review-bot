import unittest
from unittest.mock import patch, MagicMock
from src.convex_client import persist_run, _map_category


class TestConvexClient(unittest.TestCase):

    def test_map_category(self):
        self.assertEqual(_map_category("security"), "security")
        self.assertEqual(_map_category("dependency"), "dependency")
        self.assertEqual(_map_category("review"), "code_review")
        self.assertEqual(_map_category("rules"), "code_review")
        self.assertEqual(_map_category("unknown"), "code_review")

    def test_persist_run_no_url(self):
        result = persist_run(
            repo="Much1r1/pr-review-bot",
            pr_number=1,
            head_sha="sha123",
            all_comments=[],
            any_critical=False,
            convex_url=None,
        )
        self.assertIsNone(result)

    @patch("requests.post")
    def test_persist_run_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "status": "success",
            "value": "run_id_999",
        }
        mock_post.return_value = mock_response

        comments = [
            {
                "filename": "scripts/test_bait.py",
                "line": 18,
                "body": "🔒 Security [sql_injection]: Potential SQL injection",
                "severity": "critical",
                "source": "security",
            },
            {
                "filename": "pyyaml@5.1",
                "line": None,
                "body": "📦 GHSA-f456: Vulnerability",
                "severity": "high",
                "source": "dependency",
            },
        ]

        result = persist_run(
            repo="Much1r1/pr-review-bot",
            pr_number=12,
            head_sha="abc12345",
            all_comments=comments,
            any_critical=True,
            convex_url="https://happy-animal-123.convex.cloud",
            deploy_key="dev:token123",
        )

        self.assertEqual(result, "run_id_999")
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        self.assertEqual(
            call_kwargs["headers"]["Authorization"], "Bearer dev:token123"
        )
        payload = call_kwargs["json"]
        self.assertEqual(payload["path"], "runs:saveRunAndFindings")
        self.assertEqual(payload["args"]["repo"], "Much1r1/pr-review-bot")
        self.assertEqual(payload["args"]["pr_number"], 12)
        self.assertEqual(payload["args"]["total_findings"], 2)
        self.assertTrue(payload["args"]["any_critical"])
        self.assertEqual(len(payload["args"]["findings"]), 2)
        self.assertEqual(payload["args"]["findings"][0]["category"], "security")
        self.assertEqual(payload["args"]["findings"][1]["category"], "dependency")


if __name__ == "__main__":
    unittest.main()
