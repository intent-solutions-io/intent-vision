# IntentVision ADK Makefile
# Beads Task: intentvision-qd3

.PHONY: help install lint test check-nodrift check-arv-minimum check-all deploy

help:
	@echo "IntentVision ADK Commands:"
	@echo "  make install         - Install dependencies"
	@echo "  make lint            - Run linters"
	@echo "  make test            - Run tests"
	@echo "  make check-nodrift   - Check for Hard Mode violations (R1-R8)"
	@echo "  make check-arv       - Run ARV minimum gate"
	@echo "  make check-all       - Run all checks"
	@echo "  make deploy          - Deploy to Agent Engine"

install:
	pip install -r requirements.txt

lint:
	black --check agents/ service/ scripts/ tests/
	flake8 agents/ service/ scripts/ tests/
	mypy agents/ service/ scripts/

test:
	pytest tests/ -v --cov=agents --cov-report=term-missing

check-nodrift:
	bash scripts/ci/check_nodrift.sh

check-arv:
	python scripts/check_arv_minimum.py

check-all: check-nodrift check-arv test
	@echo "✅ All checks passed"

deploy:
	@echo "Usage: python scripts/deploy_inline_source.py --agent <name> --env <env>"
	@echo "Agents: orchestrator, metric-analyst, alert-tuner, onboarding-coach"
	@echo "Envs: dev, staging, prod"
