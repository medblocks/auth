# Create the client
docker-compose exec hydra     hydra clients create     --endpoint http://127.0.0.1:4445     --id auth-code-client     --secret secret     --grant-types authorization_code,refresh_token     --response-types code,id_token     --scope openid,offline     --callbacks http://127.0.0.1:5555/callback

# Start Token Auth
docker-compose exec hydra     hydra token user     --client-id auth-code-client     --client-secret secret     --endpoint http://127.0.0.1:4444/     --port 5555     --scope openid,offline

