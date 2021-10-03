# Create the client
docker run --rm hydra \
     clients create \
    --endpoint http://host.docker.internal/hydra/admin/ \
    --id auth-code-client \
    --secret secret \
    --grant-types authorization_code,refresh_token \
    --response-types code,id_token \
    --scope openid,offline \
    --callbacks http://127.0.0.1:5555/callback

# Start Token Auth
docker run -p 5555:5555 hydra \
    token user \
    --client-id auth-code-client \
    --client-secret secret \
    --endpoint http://127.0.0.1/hydra/public \
    --port 5555 \
    --scope openid,offline
