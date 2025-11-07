docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/big-website-445809/youtube-graph/youtube-graph-app:latest .
docker push us-central1-docker.pkg.dev/big-website-445809/youtube-graph/youtube-graph-app:latest

echo "sleeping"
sleep 30

echo "awake"
gcloud run services update youtube-graph --region us-central1 --image us-central1-docker.pkg.dev/big-website-445809/youtube-graph/youtube-graph-app:latest
