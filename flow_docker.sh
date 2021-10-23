# Create the client
docker run --rm hydra \
     clients create \
    --endpoint http://host.docker.internal/hydra/admin/ \
    --id svelte-app \
    --token-endpoint-auth-method none \
    --grant-types authorization_code,refresh_token \
    --scope openid,offline \
    --callbacks http://127.0.0.1:8000/

# Start Token Auth
docker run -p 5555:5555 hydra \
    token user \
    --client-id auth-code-client \
    --client-secret secret \
    --endpoint http://127.0.0.1/hydra/public \
    --port 5555 \
    --scope openid,offline
