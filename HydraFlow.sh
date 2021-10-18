# Create the client
docker-compose exec hydra  hydra clients create  --endpoint http://127.0.0.1:4455 --token-endpoint-auth-method none --grant-types authorization_code,refresh_token --response-types code,id_token --scope openid,offline --callbacks http://127.0.0.1:5555/callback

# Start Token Auth
docker-compose exec hydra   hydra token user  --client-id auth-code-client3  --client-secret secret --endpoint http://127.0.0.1:4444 --port 5555 --scope openid,offline


docker run -t -p 3001:3001 oryd/hydra token user --client-id ea183a84-dda0-44d6-a353-21209331e119 --endpoint http://143.110.254.8/hydra/public --port 3001 --scope openid,offline

