{{- define "aurora.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "aurora.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "aurora.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "aurora.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- end }}

{{- define "aurora.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aurora.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "aurora.image" -}}
{{- $img := .img -}}
{{- $reg := .root.Values.registry | default "" -}}
{{- $repo := $img.repository -}}
{{- if and $reg (not (contains "/" $repo)) }}{{ $repo = printf "%s/%s" $reg $repo }}{{ end -}}
{{- printf "%s:%s" $repo ($img.tag | default .root.Chart.AppVersion) -}}
{{- end }}

{{/* PoC credentials: reuse the existing Secret's values on upgrade (lookup), otherwise generate. */}}
{{- define "aurora.pocSecretValue" -}}
{{- $existing := lookup "v1" "Secret" .root.Release.Namespace (printf "%s-poc" (include "aurora.fullname" .root)) -}}
{{- if and $existing (hasKey $existing.data .key) -}}
{{- index $existing.data .key | b64dec -}}
{{- else -}}
{{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}

{{- define "aurora.envSecretName" -}}
{{- .Values.existingSecret | default (printf "%s-env" (include "aurora.fullname" .)) -}}
{{- end }}
