package i18n

import "strings"

// ResolveLanguage picks the best supported language from Accept-Language header,
// falling back to default.
func ResolveLanguage(acceptLang string, supported []string, fallback string) string {
	if len(supported) == 0 {
		return fallback
	}
	supportedSet := map[string]bool{}
	for _, l := range supported {
		supportedSet[strings.ToLower(l)] = true
	}
	for _, part := range strings.Split(acceptLang, ",") {
		lang := strings.TrimSpace(strings.Split(part, ";")[0])
		lang = strings.ToLower(lang)
		if supportedSet[lang] {
			return lang
		}
		// try base (e.g. en-US -> en)
		if i := strings.Index(lang, "-"); i > 0 {
			base := lang[:i]
			if supportedSet[base] {
				return base
			}
		}
	}
	return fallback
}
