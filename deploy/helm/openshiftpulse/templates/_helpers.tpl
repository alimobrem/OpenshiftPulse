{{- define "openshiftpulse.name" -}}
openshiftpulse
{{- end -}}

{{- define "openshiftpulse.namespace" -}}
{{ .Release.Namespace }}
{{- end -}}

{{- define "openshiftpulse.labels" -}}
app: openshiftpulse
app.kubernetes.io/name: openshiftpulse
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "openshiftpulse.selectorLabels" -}}
app: openshiftpulse
{{- end -}}

{{/* OAuth client secret: reuse existing on upgrades to avoid breaking sessions. */}}
{{- define "openshiftpulse.clientSecret" -}}
{{- if .Values.oauthProxy.clientSecret -}}
{{ .Values.oauthProxy.clientSecret }}
{{- else -}}
{{- $existing := lookup "v1" "Secret" (include "openshiftpulse.namespace" .) "openshiftpulse-oauth-secrets" -}}
{{- if and $existing $existing.data (index $existing.data "client-secret") -}}
{{ index $existing.data "client-secret" | b64dec }}
{{- else -}}
{{ randAlphaNum 32 }}
{{- end -}}
{{- end -}}
{{- end -}}

{{/* Cookie secret: reuse existing secret on upgrades to avoid logging users out.
     Only generate a new one on fresh install or if explicitly provided. */}}
{{- define "openshiftpulse.cookieSecret" -}}
{{- if .Values.oauthProxy.cookieSecret -}}
{{ .Values.oauthProxy.cookieSecret }}
{{- else -}}
{{- $existing := lookup "v1" "Secret" (include "openshiftpulse.namespace" .) "openshiftpulse-oauth-secrets" -}}
{{- if and $existing $existing.data (index $existing.data "cookie-secret") -}}
{{ index $existing.data "cookie-secret" | b64dec }}
{{- else -}}
{{ randAlphaNum 32 }}
{{- end -}}
{{- end -}}
{{- end -}}
