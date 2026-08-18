"""Validate the repository collaboration contract and agent skill metadata."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - handled as a validation error in main
    yaml = None


ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = (
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "AI_RULES.md",
    "CONTRIBUTING.md",
    ".env.example",
    ".gitattributes",
    ".gitignore",
    "scripts/validate_collaboration.py",
    "docs/README.md",
    "docs/COLLABORATION.md",
    "docs/PROJECT_CONTEXT.md",
    "docs/REPOSITORY_STRUCTURE.md",
    "docs/PRD.md",
    "docs/USER_FLOW.md",
    "docs/API_CONTRACT.md",
    "docs/BACKEND_V2_DESIGN.md",
    "docs/DECISIONS.md",
    "docs/DEMO.md",
    ".github/copilot-instructions.md",
    ".github/instructions/api-contract.instructions.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/ISSUE_TEMPLATE/feature.md",
    ".github/ISSUE_TEMPLATE/bug.md",
    ".github/ISSUE_TEMPLATE/config.yml",
    "mcm-reborn/AGENTS.md",
    "mcm-reborn/CLAUDE.md",
    "mcm-reborn/README.md",
    "mcm-reborn/package.json",
    "mcm-reborn/server/operator-api.ts",
    "mcm-reborn/app/api/v2/admin/applications/[applicationId]/lifecycle-commands/route.ts",
)

SKILLS = (
    "mcm-work-on-issue",
    "mcm-change-api-contract",
    "mcm-prepare-pull-request",
)

MARKDOWN_LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)


def read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def parse_yaml(text: str, source: str, errors: list[str]) -> object | None:
    if yaml is None:
        errors.append("PyYAML is required: install it before validating collaboration files")
        return None
    try:
        return yaml.safe_load(text)
    except yaml.YAMLError as error:
        errors.append(f"{source}: invalid YAML: {error}")
        return None


def parse_frontmatter(text: str, source: str, errors: list[str]) -> dict[str, object]:
    match = FRONTMATTER.match(text)
    if not match:
        errors.append(f"{source}: missing or invalid YAML frontmatter")
        return {}
    parsed = parse_yaml(match.group(1), source, errors)
    if not isinstance(parsed, dict):
        errors.append(f"{source}: frontmatter must be a mapping")
        return {}
    return parsed


def validate_skill(skill_name: str, errors: list[str]) -> None:
    base = ROOT / ".agents" / "skills" / skill_name
    skill_file = base / "SKILL.md"
    metadata_file = base / "agents" / "openai.yaml"

    for path in (skill_file, metadata_file):
        if not path.is_file():
            errors.append(f"missing skill file: {path.relative_to(ROOT).as_posix()}")
            return

    skill_text = skill_file.read_text(encoding="utf-8")
    metadata_text = metadata_file.read_text(encoding="utf-8")

    skill_source = skill_file.relative_to(ROOT).as_posix()
    frontmatter = parse_frontmatter(skill_text, skill_source, errors)
    if set(frontmatter) != {"name", "description"}:
        errors.append(f"{skill_name}: frontmatter keys must be name and description only")
    if frontmatter.get("name") != skill_name:
        errors.append(f"{skill_name}: frontmatter name does not match directory")
    if not isinstance(frontmatter.get("description"), str):
        errors.append(f"{skill_name}: description must be a non-empty string")
    if "[TODO" in skill_text or "TODO:" in skill_text:
        errors.append(f"{skill_name}: unresolved TODO in SKILL.md")

    metadata_source = metadata_file.relative_to(ROOT).as_posix()
    metadata = parse_yaml(metadata_text, metadata_source, errors)
    interface = metadata.get("interface") if isinstance(metadata, dict) else None
    required_interface_keys = {"display_name", "short_description", "default_prompt"}
    if not isinstance(interface, dict) or set(interface) != required_interface_keys:
        errors.append(f"{skill_name}: openai.yaml must define the three interface fields")
        return
    if not all(isinstance(interface.get(key), str) and interface[key].strip() for key in required_interface_keys):
        errors.append(f"{skill_name}: openai.yaml interface fields must be non-empty strings")
    if f"${skill_name}" not in str(interface.get("default_prompt", "")):
        errors.append(f"{skill_name}: default prompt must explicitly invoke the skill")


def validate_local_links(relative_path: str, errors: list[str]) -> None:
    source = ROOT / relative_path
    if source.suffix.lower() != ".md" or not source.is_file():
        return

    for raw_target in MARKDOWN_LINK.findall(source.read_text(encoding="utf-8")):
        target = raw_target.strip().strip("<>").split("#", 1)[0]
        if not target or re.match(r"^[a-z][a-z0-9+.-]*:", target, re.IGNORECASE):
            continue
        resolved = (source.parent / target).resolve()
        try:
            resolved.relative_to(ROOT.resolve())
        except ValueError:
            errors.append(f"{relative_path}: link escapes repository: {raw_target}")
            continue
        if not resolved.exists():
            errors.append(f"{relative_path}: broken local link: {raw_target}")


def validate_github_yaml(errors: list[str]) -> None:
    config = parse_yaml(
        read(".github/ISSUE_TEMPLATE/config.yml"),
        ".github/ISSUE_TEMPLATE/config.yml",
        errors,
    )
    if not isinstance(config, dict) or config.get("blank_issues_enabled") is not False:
        errors.append("issue template config must disable blank issues")
    if not isinstance(config, dict) or not isinstance(config.get("contact_links"), list):
        errors.append("issue template config must provide contact_links")

    for relative_path in (
        ".github/ISSUE_TEMPLATE/feature.md",
        ".github/ISSUE_TEMPLATE/bug.md",
    ):
        frontmatter = parse_frontmatter(read(relative_path), relative_path, errors)
        if not all(isinstance(frontmatter.get(key), str) for key in ("name", "about", "title")):
            errors.append(f"{relative_path}: name, about and title must be strings")

    instruction_path = ".github/instructions/api-contract.instructions.md"
    instruction = parse_frontmatter(read(instruction_path), instruction_path, errors)
    apply_to = instruction.get("applyTo")
    for contract_file in ("openapi.yaml", "mock-data.json", "supabase-schema.sql"):
        if not isinstance(apply_to, str) or contract_file not in apply_to:
            errors.append(f"{instruction_path}: applyTo must include {contract_file}")
    if not isinstance(apply_to, str) or "mcm-reborn/app/api/**/*.ts" not in apply_to:
        errors.append(f"{instruction_path}: applyTo must include Next.js route handlers")


def validate_environment_guard(errors: list[str]) -> None:
    env_values: dict[str, str] = {}
    for line in read(".env.example").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env_values[key] = value

    required_keys = {
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_APP_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "OPENAI_API_KEY",
        "OPENAI_VISION_MODEL",
        "ENABLE_EXTERNAL_AI",
        "EXTERNAL_AI_PRIVACY_NOTICE_VERSION",
        "AI_MODE",
        "DEMO_TIMELINE_PROFILE",
        "ENABLE_DEMO_LOGIN",
    }
    missing_keys = sorted(required_keys - env_values.keys())
    if missing_keys:
        errors.append(f".env.example: missing keys: {', '.join(missing_keys)}")
    for secret_key in ("SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY"):
        if env_values.get(secret_key):
            errors.append(f".env.example: {secret_key} must not contain a value")
    for disabled_by_default in ("ENABLE_EXTERNAL_AI", "ENABLE_DEMO_LOGIN"):
        if env_values.get(disabled_by_default) != "false":
            errors.append(f".env.example: {disabled_by_default} must default to false")

    gitignore_lines = set(read(".gitignore").splitlines())
    for pattern in (".env", ".env.*", "!.env.example"):
        if pattern not in gitignore_lines:
            errors.append(f".gitignore must contain {pattern}")


def validate_next_app(errors: list[str]) -> None:
    try:
        package = json.loads(read("mcm-reborn/package.json"))
    except json.JSONDecodeError as error:
        errors.append(f"mcm-reborn/package.json: invalid JSON: {error}")
        return

    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        errors.append("mcm-reborn/package.json: scripts must be an object")
    else:
        for script_name in ("dev", "build", "start", "lint", "typecheck"):
            if not isinstance(scripts.get(script_name), str):
                errors.append(f"mcm-reborn/package.json: missing {script_name} script")
        if scripts.get("typecheck") != "tsc --noEmit --incremental false":
            errors.append("mcm-reborn/package.json: typecheck script must run no-emit tsc")

    dependencies = package.get("dependencies")
    next_version = dependencies.get("next") if isinstance(dependencies, dict) else None
    react_version = dependencies.get("react") if isinstance(dependencies, dict) else None
    if not isinstance(next_version, str) or not isinstance(react_version, str):
        errors.append("mcm-reborn/package.json: Next.js and React versions are required")
    else:
        project_context = read("docs/PROJECT_CONTEXT.md")
        for label, version in (("Next.js", next_version), ("React", react_version)):
            if version not in project_context:
                errors.append(f"docs/PROJECT_CONTEXT.md must document {label} {version}")

    nested_agents = read("mcm-reborn/AGENTS.md")
    for marker in (
        "<!-- BEGIN:nextjs-agent-rules -->",
        "<!-- END:nextjs-agent-rules -->",
        "../AGENTS.md",
        "../AI_RULES.md",
        "../docs/PROJECT_CONTEXT.md",
        "../docs/REPOSITORY_STRUCTURE.md",
    ):
        if marker not in nested_agents:
            errors.append(f"mcm-reborn/AGENTS.md must contain {marker}")

    root_claude = read("CLAUDE.md")
    nested_claude = read("mcm-reborn/CLAUDE.md")
    if "@AGENTS.md" not in root_claude:
        errors.append("CLAUDE.md must reference @AGENTS.md")
    for reference in ("@../AGENTS.md", "@AGENTS.md"):
        if reference not in nested_claude:
            errors.append(f"mcm-reborn/CLAUDE.md must reference {reference}")


def validate_contract_version(errors: list[str]) -> None:
    openapi = parse_yaml(read("openapi.yaml"), "openapi.yaml", errors)
    specification_version = openapi.get("openapi") if isinstance(openapi, dict) else None
    info = openapi.get("info") if isinstance(openapi, dict) else None
    contract_version = info.get("version") if isinstance(info, dict) else None
    if specification_version != "3.1.0":
        errors.append("openapi.yaml: openapi must be 3.1.0")
    if not isinstance(contract_version, str):
        errors.append("openapi.yaml: info.version must be a string")
        return
    for relative_path in ("docs/PROJECT_CONTEXT.md", "docs/API_CONTRACT.md"):
        text = read(relative_path)
        if f"API 계약 v{contract_version}" not in text:
            errors.append(f"{relative_path} must document API contract v{contract_version}")
        if isinstance(specification_version, str) and f"OpenAPI {specification_version}" not in text:
            errors.append(
                f"{relative_path} must document OpenAPI specification {specification_version}"
            )

    misleading_version = re.compile(r"\bOpenAPI\s+2\.0\.0\b")
    for path in (ROOT / "docs").rglob("*.md"):
        if misleading_version.search(path.read_text(encoding="utf-8")):
            errors.append(
                f"{path.relative_to(ROOT).as_posix()}: do not confuse API contract "
                "v2.0.0 with the OpenAPI 3.1.0 specification"
            )


def validate_current_route_docs(errors: list[str]) -> None:
    for relative_path in (
        "docs/mvp-beta/plan-summary.md",
        "docs/mvp-beta/screen-matrix.md",
    ):
        text = read(relative_path)
        if not re.search(r"\|\s*서비스 소개\s*\|[^\n]*`/`[^\n]*`/intro`", text):
            errors.append(f"{relative_path}: service intro routes must include / and /intro")
        if not re.search(r"\|\s*홈\s*\|[^\n]*`/home`", text):
            errors.append(f"{relative_path}: home route must be /home")

    structure = read("docs/REPOSITORY_STRUCTURE.md")
    for marker in (
        "`/`·`/intro`는 서비스 소개",
        "`/home`은 홈",
        "23개 v2 Route Handler 파일",
        "25개 API operation",
        "`mcm-reborn/server/`",
    ):
        if marker not in structure:
            errors.append(f"docs/REPOSITORY_STRUCTURE.md must contain {marker}")

    lifecycle_route = read(
        "mcm-reborn/app/api/v2/admin/applications/[applicationId]/lifecycle-commands/route.ts"
    )
    for marker in (
        "export async function POST",
        'operation: "advanceApplicationLifecycle"',
        '"advance_application_lifecycle"',
        "executeIdempotentOperatorCommand",
        "readShipment",
    ):
        if marker not in lifecycle_route:
            errors.append(f"lifecycle Route Handler must contain {marker}")

    operator_api = read("mcm-reborn/server/operator-api.ts")
    for marker in (
        'request.headers.get("authorization")',
        'request.headers.get("idempotency-key")',
        "SUPABASE_SERVICE_ROLE_KEY",
        '"/auth/v1/user"',
        'role: "eq.OPERATOR"',
        '"/rest/v1/idempotency_keys"',
    ):
        if marker not in operator_api:
            errors.append(f"operator API helper must contain {marker}")


def main() -> int:
    errors: list[str] = []

    for relative_path in REQUIRED_FILES:
        path = ROOT / relative_path
        if not path.is_file():
            errors.append(f"missing required file: {relative_path}")
        elif relative_path not in {"CLAUDE.md", "mcm-reborn/CLAUDE.md"} and len(
            path.read_text(encoding="utf-8").strip()
        ) < 40:
            errors.append(f"required file is unexpectedly short: {relative_path}")
        else:
            validate_local_links(relative_path, errors)

    for skill_name in SKILLS:
        validate_skill(skill_name, errors)

    if all((ROOT / path).is_file() for path in (
        ".github/ISSUE_TEMPLATE/config.yml",
        ".github/ISSUE_TEMPLATE/feature.md",
        ".github/ISSUE_TEMPLATE/bug.md",
        ".github/instructions/api-contract.instructions.md",
    )):
        validate_github_yaml(errors)

    if (ROOT / ".env.example").is_file() and (ROOT / ".gitignore").is_file():
        validate_environment_guard(errors)

    if all((ROOT / path).is_file() for path in (
        "mcm-reborn/package.json",
        "mcm-reborn/AGENTS.md",
        "mcm-reborn/CLAUDE.md",
        "CLAUDE.md",
        "docs/PROJECT_CONTEXT.md",
    )):
        validate_next_app(errors)

    if all((ROOT / path).is_file() for path in (
        "openapi.yaml",
        "docs/PROJECT_CONTEXT.md",
        "docs/API_CONTRACT.md",
    )):
        validate_contract_version(errors)

    if all((ROOT / path).is_file() for path in (
        "docs/mvp-beta/plan-summary.md",
        "docs/mvp-beta/screen-matrix.md",
        "docs/REPOSITORY_STRUCTURE.md",
    )):
        validate_current_route_docs(errors)

    if (ROOT / "AGENTS.md").is_file():
        agents_text = read("AGENTS.md")
        for required_reference in (
            "AI_RULES.md",
            "docs/PROJECT_CONTEXT.md",
            "docs/COLLABORATION.md",
            "docs/REPOSITORY_STRUCTURE.md",
            "mcm-reborn/AGENTS.md",
        ):
            if required_reference not in agents_text:
                errors.append(f"AGENTS.md does not reference {required_reference}")
        for skill_name in SKILLS:
            if f"${skill_name}" not in agents_text:
                errors.append(f"AGENTS.md does not reference ${skill_name}")
        if "`main`과 `develop`에 직접 push하지 않는다" not in agents_text:
            errors.append("AGENTS.md must protect main and develop from direct pushes")
        for command in (
            "npm --prefix mcm-reborn run lint",
            "npm --prefix mcm-reborn run typecheck",
            "npm --prefix mcm-reborn run build",
        ):
            if command not in agents_text:
                errors.append(f"AGENTS.md does not include {command}")

    if (ROOT / ".github/PULL_REQUEST_TEMPLATE.md").is_file():
        template = read(".github/PULL_REQUEST_TEMPLATE.md")
        for required_section in ("관련 이슈", "롤백", "AI 사용 공개", "실행한 명령"):
            if required_section not in template:
                errors.append(f"PR template does not include {required_section}")

    if errors:
        print("Collaboration contract validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        f"Collaboration contract OK: {len(REQUIRED_FILES)} files, "
        f"{len(SKILLS)} skills"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
