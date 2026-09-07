"""Keep historical usage visible when the public plugin namespace changes."""
import unittest

from persona_usage_audit import classify_event


class PluginRenameTests(unittest.TestCase):
    def test_old_and_new_commands_preserve_namespace_and_full_command(self):
        for namespace in ("persona-lab", "ai-persona-lab"):
            for command in ("run", "persona-review", "submit-feedback"):
                invocation = f"/{namespace}:{command}"
                with self.subTest(invocation=invocation):
                    self.assertEqual(
                        classify_event("", {}, "user", invocation + " Review this"),
                        ("plugin", "command:" + invocation),
                    )

    def test_unrelated_namespace_is_not_plugin_usage(self):
        self.assertIsNone(classify_event("", {}, "user", "/other-lab:run"))


if __name__ == "__main__":
    unittest.main()
