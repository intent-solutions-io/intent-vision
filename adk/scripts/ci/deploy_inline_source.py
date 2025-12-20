#!/usr/bin/env python3
"""
IntentVision ADK Agent Engine Deployment Script

Beads Task: intentvision-qd3.4

Deploys agents to Vertex AI Agent Engine using inline source deployment.
This script is called from CI/CD - NOT for manual execution.

Following bobs-brain patterns:
- R2: Agent Engine deployment (not self-hosted Runner)
- R4: CI-only deployment
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Agent configurations
AGENTS = {
    "orchestrator": {
        "display_name": "IntentVision Orchestrator",
        "description": "Routes requests to specialist agents",
        "module": "adk.agents.orchestrator.agent",
        "app_var": "app",
    },
    "metric-analyst": {
        "display_name": "IntentVision Metric Analyst",
        "description": "Specialist in forecast and anomaly analysis",
        "module": "adk.agents.metric_analyst.agent",
        "app_var": "app",
    },
    "alert-tuner": {
        "display_name": "IntentVision Alert Tuner",
        "description": "Specialist in alert optimization",
        "module": "adk.agents.alert_tuner.agent",
        "app_var": "app",
    },
    "onboarding-coach": {
        "display_name": "IntentVision Onboarding Coach",
        "description": "Specialist in metric setup assistance",
        "module": "adk.agents.onboarding_coach.agent",
        "app_var": "app",
    },
}

# Deployment configuration
DEFAULT_PROJECT = os.getenv("PROJECT_ID", "intentvision")
DEFAULT_LOCATION = os.getenv("LOCATION", "us-central1")
DEFAULT_STAGING_BUCKET = os.getenv("STAGING_BUCKET", "gs://intentvision-agent-staging")


def run_command(cmd: List[str], dry_run: bool = False) -> subprocess.CompletedProcess:
    """Run a shell command and return result."""
    if dry_run:
        print(f"[DRY-RUN] Would execute: {' '.join(cmd)}")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    print(f"[EXEC] {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"[ERROR] Command failed with exit code {result.returncode}")
        print(f"[STDERR] {result.stderr}")
        raise subprocess.CalledProcessError(result.returncode, cmd, result.stdout, result.stderr)

    return result


def get_agent_engine_id(agent_name: str, env: str) -> str:
    """Generate Agent Engine ID for an agent."""
    return f"intentvision-{agent_name}-{env}"


def deploy_agent(
    agent_name: str,
    env: str,
    project: str,
    location: str,
    staging_bucket: str,
    adk_root: Path,
    dry_run: bool = False,
) -> Dict:
    """Deploy a single agent to Agent Engine."""
    if agent_name not in AGENTS:
        raise ValueError(f"Unknown agent: {agent_name}")

    config = AGENTS[agent_name]
    agent_engine_id = get_agent_engine_id(agent_name, env)

    print(f"\n{'='*50}")
    print(f"Deploying: {agent_name}")
    print(f"Environment: {env}")
    print(f"Agent Engine ID: {agent_engine_id}")
    print(f"{'='*50}\n")

    # Build deployment command
    # Using gcloud agent-builder (preview) for inline source deployment
    cmd = [
        "gcloud", "alpha", "agent-builder", "agents", "create",
        agent_engine_id,
        f"--project={project}",
        f"--location={location}",
        f"--display-name={config['display_name']} ({env})",
        f"--description={config['description']}",
        "--agent-type=AGENT_TYPE_ADK",
        f"--source-directory={adk_root}",
        f"--agent-module={config['module']}",
        f"--agent-app-var={config['app_var']}",
        f"--staging-bucket={staging_bucket}",
        "--format=json",
    ]

    try:
        result = run_command(cmd, dry_run=dry_run)
        if not dry_run:
            deployment_info = json.loads(result.stdout)
            return {
                "agent_name": agent_name,
                "agent_engine_id": agent_engine_id,
                "status": "deployed",
                "details": deployment_info,
            }
        return {
            "agent_name": agent_name,
            "agent_engine_id": agent_engine_id,
            "status": "dry-run",
        }
    except subprocess.CalledProcessError as e:
        return {
            "agent_name": agent_name,
            "agent_engine_id": agent_engine_id,
            "status": "failed",
            "error": str(e),
        }


def update_agent(
    agent_name: str,
    env: str,
    project: str,
    location: str,
    staging_bucket: str,
    adk_root: Path,
    dry_run: bool = False,
) -> Dict:
    """Update an existing agent in Agent Engine."""
    if agent_name not in AGENTS:
        raise ValueError(f"Unknown agent: {agent_name}")

    config = AGENTS[agent_name]
    agent_engine_id = get_agent_engine_id(agent_name, env)

    print(f"\n{'='*50}")
    print(f"Updating: {agent_name}")
    print(f"Environment: {env}")
    print(f"Agent Engine ID: {agent_engine_id}")
    print(f"{'='*50}\n")

    # Build update command
    cmd = [
        "gcloud", "alpha", "agent-builder", "agents", "update",
        agent_engine_id,
        f"--project={project}",
        f"--location={location}",
        f"--source-directory={adk_root}",
        f"--staging-bucket={staging_bucket}",
        "--format=json",
    ]

    try:
        result = run_command(cmd, dry_run=dry_run)
        if not dry_run:
            deployment_info = json.loads(result.stdout) if result.stdout else {}
            return {
                "agent_name": agent_name,
                "agent_engine_id": agent_engine_id,
                "status": "updated",
                "details": deployment_info,
            }
        return {
            "agent_name": agent_name,
            "agent_engine_id": agent_engine_id,
            "status": "dry-run",
        }
    except subprocess.CalledProcessError as e:
        return {
            "agent_name": agent_name,
            "agent_engine_id": agent_engine_id,
            "status": "failed",
            "error": str(e),
        }


def main():
    parser = argparse.ArgumentParser(
        description="Deploy IntentVision agents to Vertex AI Agent Engine"
    )
    parser.add_argument(
        "--agent",
        choices=list(AGENTS.keys()) + ["all"],
        default="all",
        help="Agent to deploy (default: all)",
    )
    parser.add_argument(
        "--env",
        choices=["dev", "staging", "prod"],
        default="dev",
        help="Deployment environment (default: dev)",
    )
    parser.add_argument(
        "--action",
        choices=["create", "update"],
        default="update",
        help="Deployment action (default: update)",
    )
    parser.add_argument(
        "--project",
        default=DEFAULT_PROJECT,
        help=f"GCP project ID (default: {DEFAULT_PROJECT})",
    )
    parser.add_argument(
        "--location",
        default=DEFAULT_LOCATION,
        help=f"GCP region (default: {DEFAULT_LOCATION})",
    )
    parser.add_argument(
        "--staging-bucket",
        default=DEFAULT_STAGING_BUCKET,
        help=f"Staging bucket for deployment (default: {DEFAULT_STAGING_BUCKET})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without executing",
    )

    args = parser.parse_args()

    # Determine ADK root
    script_dir = Path(__file__).parent
    adk_root = script_dir.parent.parent

    print("=" * 60)
    print("IntentVision Agent Engine Deployment")
    print("=" * 60)
    print(f"ADK Root: {adk_root}")
    print(f"Project: {args.project}")
    print(f"Location: {args.location}")
    print(f"Environment: {args.env}")
    print(f"Action: {args.action}")
    print(f"Dry Run: {args.dry_run}")
    print()

    # Determine agents to deploy
    agents_to_deploy = list(AGENTS.keys()) if args.agent == "all" else [args.agent]

    results = []
    for agent_name in agents_to_deploy:
        if args.action == "create":
            result = deploy_agent(
                agent_name=agent_name,
                env=args.env,
                project=args.project,
                location=args.location,
                staging_bucket=args.staging_bucket,
                adk_root=adk_root,
                dry_run=args.dry_run,
            )
        else:
            result = update_agent(
                agent_name=agent_name,
                env=args.env,
                project=args.project,
                location=args.location,
                staging_bucket=args.staging_bucket,
                adk_root=adk_root,
                dry_run=args.dry_run,
            )
        results.append(result)

    # Summary
    print("\n" + "=" * 60)
    print("DEPLOYMENT SUMMARY")
    print("=" * 60)

    success_count = 0
    for result in results:
        status = result["status"]
        if status in ("deployed", "updated", "dry-run"):
            success_count += 1
            print(f"[OK] {result['agent_name']}: {status}")
        else:
            print(f"[FAIL] {result['agent_name']}: {result.get('error', 'unknown error')}")

    print()
    print(f"Total: {len(results)}, Success: {success_count}, Failed: {len(results) - success_count}")

    # Exit with error if any failed
    if success_count < len(results):
        sys.exit(1)

    print("\nDeployment complete!")


if __name__ == "__main__":
    main()
