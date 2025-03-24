version="$1"
branch="$2"
echo "Dispatching build workflow runs for version $version on branch $branch"
curl -v \
-H "Accept: application/vnd.github.everest-preview+json" \
-H "Authorization: token ${GITHUB_TOKEN}" \
https://api.github.com/repos/biclighter81/carrier/dispatches \
-d "{ \"event_type\": \"build-broker\", \"client_payload\": {\"version\": \"$version\", \"branch\": \"$branch\"} }"

curl -v \
-H "Accept: application/vnd.github.everest-preview+json" \
-H "Authorization: token ${GITHUB_TOKEN}" \
https://api.github.com/repos/biclighter81/carrier/dispatches \
-d "{ \"event_type\": \"build-wms\", \"client_payload\": {\"version\": \"$version\", \"branch\": \"$branch\"} }"

curl -v \
-H "Accept: application/vnd.github.everest-preview+json" \
-H "Authorization: token ${GITHUB_TOKEN}" \
https://api.github.com/repos/biclighter81/carrier/dispatches \
-d "{ \"event_type\": \"build-carrier-internal\", \"client_payload\": {\"version\": \"$version\", \"branch\": \"$branch\"} }"

curl -v \
-H "Accept: application/vnd.github.everest-preview+json" \
-H "Authorization: token ${GITHUB_TOKEN}" \
https://api.github.com/repos/biclighter81/carrier/dispatches \
-d "{ \"event_type\": \"build-carrier-external-dhl\", \"client_payload\": {\"version\": \"$version\", \"branch\": \"$branch\"} }"