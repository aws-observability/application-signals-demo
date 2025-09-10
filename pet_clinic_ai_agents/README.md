# Pet Clinic AI Agents

### Primary Agent (Pet Clinic Assistant)
- **Purpose**: General pet clinic assistant handling appointment scheduling, clinic information, and emergency contacts
- **Capabilities**: 
  - Answers general pet clinic questions
  - Provides clinic hours and contact information
  - Handles appointment-related queries
  - Delegates nutrition questions to the Nutrition Agent
  - Rejects requests unrelated to the pet clinic.
- **Entry Point**: `pet_clinic_agent.py`

### Nutrition Agent
- **Purpose**: Specialized agent focused on pet nutrition and dietary guidance
- **Capabilities**:
  - Provides pet nutrition recommendations
  - Offers diet guidelines for different pets
  - Answers feeding-related questions
  - Gives specialized nutritional advice
  - Includes configurable random failure simulations.
- **Entry Point**: `nutrition_agent.py`

## Architecture

- **Bedrock AgentCore Runtime**: Containerized host service for AI agents: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html
- **Strands SDK**: Code-first framework for building agents: https://strandsagents.com/latest/documentation/docs/
 
## Deployment

Deploy using the setup script:
```bash
cd scripts/agents && ./setup-agents-demo.sh --region=us-east-1
```