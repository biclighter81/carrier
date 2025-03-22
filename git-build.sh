version="$1"
branch="$2"
echo "Dispatching broker build workflow run for version $version on branch $branch"
curl -v \
-H "Accept: application/vnd.github.everest-preview+json" \
-H "Authorization: token ${GITHUB_TOKEN}" \
https://api.github.com/repos/biclighter81/carrier/dispatches \
-d "{ \"event_type\": \"build-broker\", \"client_payload\": {\"version\": \"$version\", \"branch\": \"$branch\"} }"