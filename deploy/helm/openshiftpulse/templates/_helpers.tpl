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

{{/* Generate OAuth client secret if not provided */}}
{{- define "openshiftpulse.clientSecret" -}}
{{- if .Values.oauthProxy.clientSecret -}}
{{ .Values.oauthProxy.clientSecret }}
{{- else -}}
{{ randAlphaNum 32 }}
{{- end -}}
{{- end -}}

{{/* Generate cookie secret if not provided (must be 16, 24, or 32 bytes) */}}
{{- define "openshiftpulse.cookieSecret" -}}
{{- if .Values.oauthProxy.cookieSecret -}}
{{ .Values.oauthProxy.cookieSecret }}
{{- else -}}
{{ randAlphaNum 32 }}
{{- end -}}
{{- end -}}
