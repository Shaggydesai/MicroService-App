{{/* Chart name/version label */}}
{{- define "shopverse.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Release-scoped name of a component, e.g. "prod-user-service" */}}
{{- define "shopverse.componentName" -}}
{{- printf "%s-%s" .root.Release.Name .name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "shopverse.labels" -}}
helm.sh/chart: {{ include "shopverse.chart" .root }}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/part-of: shopverse
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
{{- end -}}

{{- define "shopverse.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end -}}

{{- define "shopverse.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" .Release.Name -}}
{{- end -}}
{{- end -}}

{{- define "shopverse.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (printf "%s-shopverse" .Release.Name) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/* Effective config for a service: serviceDefaults deep-merged with services.<name> */}}
{{- define "shopverse.serviceConfig" -}}
{{- $cfg := mergeOverwrite (deepCopy .root.Values.serviceDefaults) (deepCopy .cfg) -}}
{{- toYaml $cfg -}}
{{- end -}}

{{- define "shopverse.image" -}}
{{- $tag := default .root.Values.global.imageTag .cfg.tag -}}
{{- printf "%s/%s:%s" (trimSuffix "/" .root.Values.global.imageRegistry) .cfg.image (toString $tag) -}}
{{- end -}}

{{- define "shopverse.serviceUrl" -}}
{{- printf "http://%s-%s:8080" .root.Release.Name .name -}}
{{- end -}}

{{- define "shopverse.mongoHost" -}}
{{- if .Values.mongodb.enabled -}}
{{- printf "%s-mongodb:%v" .Release.Name .Values.mongodb.port -}}
{{- else -}}
{{- required "mongodb.external.host is required when mongodb.enabled=false" .Values.mongodb.external.host -}}
{{- end -}}
{{- end -}}
