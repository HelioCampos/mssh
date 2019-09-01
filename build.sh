#!/usr/bin/env bash

SERVICE_NAME=`node -e 'console.log(require("./package.json").name)'`
DOCKER_ORG=eonclash

PUBLISH=false

VERSION=false
MAJOR=false
MINOR=false
PATCH=false
UPREV=false

Showhelp () {
  scriptname=`basename "$0"`
  echo "
${scriptname} <options>

  Options:
    -M, --major - Increment the major version number
    -m, --minor - Increment the minor version number
    -p, --patch - Increment the patch version number
    -v <version>, --version <version> - Set the version number
    -P, --publish - Publish the image to docker hub

    -h or --help - Show this screen
    "
    exit 0
}

while [[ $# > 0 ]]
do
  key="$1"
  case "${key}" in
    -M|--major)
      MAJOR=true
      UPREV=true
    ;;
    -m|--minor)
      MINOR=true
      UPREV=true
    ;;
    -p|--patch)
      PATCH=true
      UPREV=true
    ;;
    -v|--version)
      VERSION="$2"
      shift
    ;;
    -P|--publish)
      PUBLISH=true
    ;;
    -h|--help)
      Showhelp
    ;;
    *)
    # unknown option
    ;;  esac
  shift # past argument or value
done

# Get the current script directory

SOURCE="${BASH_SOURCE[0]}"
while [ -h "${SOURCE}" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "${SOURCE}" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "${SOURCE}")"
  [[ ${SOURCE} != /* ]] && SOURCE="${DIR}/${SOURCE}" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "${SOURCE}" )" >/dev/null 2>&1 && pwd )"

cd "${DIR}"

if [[ ${UPREV} != true ]]; then
  PATCH=true
fi

if [[ ${UPREV} == true ]]; then
  if [[ ${VERSION} == false ]]; then
    VERSION=`node -e 'console.log(require("./package.json").version)'`
  fi
  a=( ${VERSION//./ } )
  if [[ ${MAJOR} == true ]]; then
    ((a[0]++))
    a[1]=0
    a[2]=0
  fi

  if [[ ${MINOR} == true ]]; then
    ((a[1]++))
    a[2]=0
  fi

  if [[ ${PATCH} == true ]]; then
    ((a[2]++))
  fi

  VERSION="${a[0]}.${a[1]}.${a[2]}"
  echo "*****Calculated next build number: ${VERSION}*****"
fi

if [[ ${VERSION} == false ]]; then
  VERSION=`node -e 'console.log(require("./package.json").version)'`
else
  yarn version "${VERSION}"
  git add package.json
  git commit -m "v${VERSION}"
  git push origin master
fi
SERVICE_VERSION="v${VERSION}"

if [ -d "${DIR}/public" ]; then
  cd "${DIR}/public"
  yarn build
  cd "${DIR}"
fi

EXITED=`docker ps -aq --filter status=exited`
if [[ "${EXITED}" != "" ]]; then
  docker rm $(docker ps -aq --filter status=exited)
fi
docker image rm "${SERVICE_NAME}:latest"
docker image rm "${DOCKER_ORG}/${SERVICE_NAME}:latest"
docker image rm "${DOCKER_ORG}/${SERVICE_NAME}:${SERVICE_VERSION}"

set -ex

docker build --rm --tag "${SERVICE_NAME}:latest" \
  --build-arg "SERVICE_VERSION=${SERVICE_VERSION}" .
docker tag "${SERVICE_NAME}:latest" "${DOCKER_ORG}/${SERVICE_NAME}:latest"
docker tag "${SERVICE_NAME}:latest" "${DOCKER_ORG}/${SERVICE_NAME}:${SERVICE_VERSION}"

if [[ ${PUBLISH} == true ]]; then
  docker push "$DOCKER_ORG/$SERVICE_NAME:latest"
  docker push "$DOCKER_ORG/$SERVICE_NAME:${SERVICE_VERSION}"
fi
