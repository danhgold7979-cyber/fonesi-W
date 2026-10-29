# Kiểm kê 110 field signatures

Chữ ký khảo sát có thể được dùng lại ở nhiều modal. `contextVariants` trong JSON quy định owner/meaning riêng; options của reference không tự trở thành options production. Toàn bộ runtime fields vẫn PLANNED.

| ID | DOM / binding | Input | Owner | Bước | Context variants |
|---|---|---|---|---|---|
| FIELD-001 | device-filter | input/text | P08 | S075 |  |
| FIELD-002 | device-size | input/range | P08 | S075 |  |
| FIELD-003 | {} | input/checkbox | P08 | S075 |  |
| FIELD-004 | {"deviceEnable": "*"} | input/checkbox | P08 | S075 |  |
| FIELD-005 | node-search | input/text | P04 | S029 |  |
| FIELD-006 | {"prop": "name"} | input/text | P04 | S036 |  |
| FIELD-007 | {"prop": "method"} | select/select-one | P04 | S036 |  |
| FIELD-008 | {"prop": "timeout"} | input/number | P04 | S036 |  |
| FIELD-009 | {"prop": "value"} | input/text | P04 | S036 |  |
| FIELD-010 | {"prop": "selector"} | input/text | P04 | S036 |  |
| FIELD-011 | {"prop": "delayMin"} | input/number | P04 | S036 |  |
| FIELD-012 | {"prop": "delayMax"} | input/number | P04 | S036 |  |
| FIELD-013 | test-device | select/select-one | P09 | S081 |  |
| FIELD-014 | phone-zoom | input/range | P09 | S084 |  |
| FIELD-015 | setup-app | select/select-one | P06 | S050, S051 |  |
| FIELD-016 | setup-workflow | select/select-one | P06 | S050, S051 |  |
| FIELD-017 | setup-account | select/select-one | P06 | S050, S051 |  |
| FIELD-018 | setup-target | select/select-one | P06 | S050, S051 |  |
| FIELD-019 | row-filter | input/text | P06 | S056, S051 |  |
| FIELD-020 | row-status | select/select-one | P06 | S056, S051 |  |
| FIELD-021 | check-all | input/checkbox | P06 | S056, S051 |  |
| FIELD-022 | {"rowCheck": "*"} | input/checkbox | P06 | S056, S051 |  |
| FIELD-023 | {"rowField": "caption"} | textarea/textarea | P06 | S056, S051 |  |
| FIELD-024 | {"rowField": "hashtags"} | input/text | P06 | S056, S051 |  |
| FIELD-025 | {"rowField": "comments"} | textarea/textarea | P06 | S056, S051 |  |
| FIELD-026 | {"rowField": "affiliate"} | input/text | P06 | S056, S051 |  |
| FIELD-027 | daily | input/number | P07 | S060 |  |
| FIELD-028 | start-date | input/date | P07 | S060 |  |
| FIELD-029 | {"slot": "0"} | input/time | P07 | S060 |  |
| FIELD-030 | {"slot": "1"} | input/time | P07 | S060 |  |
| FIELD-031 | {"slot": "2"} | input/time | P07 | S060 |  |
| FIELD-032 | random-schedule | input/checkbox | P07 | S061 |  |
| FIELD-033 | random-minutes | input/number | P07 | S061 |  |
| FIELD-034 | schedule-scope | select/select-one | P07 | S062 |  |
| FIELD-035 | timeline-date | input/date | P07 | S065 |  |
| FIELD-036 | timeline-device | select/select-one | P07 | S065 |  |
| FIELD-037 | adv-name | input/text | P04 | S036 |  |
| FIELD-038 | adv-retries | input/number | P04 | S036 |  |
| FIELD-039 | adv-effect | select/select-one | P04 | S036 |  |
| FIELD-040 | adv-duration | input/number | P04 | S036 |  |
| FIELD-041 | adv-loops | input/number | P04 | S036 |  |
| FIELD-042 | adv-confidence | input/number | P04 | S036 |  |
| FIELD-043 | adv-from | input/text | P04 | S036 |  |
| FIELD-044 | adv-to | input/text | P04 | S036 |  |
| FIELD-045 | adv-inputmode | select/select-one | P04 | S036 |  |
| FIELD-046 | adv-errorscope | select/select-one | P04 | S036 |  |
| FIELD-047 | adv-fallback | textarea/textarea | P04 | S036 |  |
| FIELD-048 | adv-desc | input/text | P04 | S036 |  |
| FIELD-049 | adv-branch | select/select-one | P04 | S036, S049 |  |
| FIELD-050 | {"inputKey": ""} | input/text | P01 | S010, S036 |  |
| FIELD-051 | {"inputType": ""} | select/select-one | P01 | S010, S036 |  |
| FIELD-052 | {"inputScope": ""} | select/select-one | P01 | S010, S036 |  |
| FIELD-053 | {"inputRequired": ""} | input/checkbox | P01 | S010, S036 |  |
| FIELD-054 | test-row | select/select-one | P05 | S049 |  |
| FIELD-055 | test-scenario | select/select-one | P05 | S049 |  |
| FIELD-056 | {} | input/text | P03 | S025, S083, S029 | pick-element: P09; workflow-manage: P04; settings: P03 |
| FIELD-057 | new-sub-name | input/text | P04 | S037 |  |
| FIELD-058 | convert-name | input/text | P04 | S037 |  |
| FIELD-059 | rename-node-value | input/text | P04 | S036 |  |
| FIELD-060 | new-wf-app | select/select-one | P04 | S029, S016 |  |
| FIELD-061 | new-wf-kind | select/select-one | P04 | S029, S016 |  |
| FIELD-062 | new-wf-name | input/text | P04 | S029, S016 |  |
| FIELD-063 | wf-name | input/text | P04 | S029, S016 |  |
| FIELD-064 | {} | input/text | P08 | S071 |  |
| FIELD-065 | {} | select/select-one | P03 | S025, S071, S050, S101 | device-manager: P08; process-options: P06; review-result: P11; settings: P03 |
| FIELD-066 | bulk-field | select/select-one | P06 | S057 |  |
| FIELD-067 | bulk-mode | select/select-one | P06 | S057 |  |
| FIELD-068 | bulk-value | textarea/textarea | P06 | S057 |  |
| FIELD-069 | clone-device | select/select-one | P06 | S050 |  |
| FIELD-070 | clone-target | select/select-one | P06 | S050 |  |
| FIELD-071 | clone-data | input/checkbox | P06 | S050 |  |
| FIELD-072 | source-subfolders | input/checkbox | P06 | S053 |  |
| FIELD-073 | source-watcher | input/checkbox | P06 | S053 |  |
| FIELD-074 | source-append | input/checkbox | P06 | S053 |  |
| FIELD-075 | source-dedupe | input/checkbox | P06 | S053 |  |
| FIELD-076 | {} | input/text | P11 | S101 |  |
| FIELD-077 | {} | textarea/textarea | P11 | S101 |  |
| FIELD-078 | set-theme | select/select-one | P03 | S023 |  |
| FIELD-079 | set-overdue | select/select-one | P07 | S061, S017 |  |
| FIELD-080 | {"slot": "3"} | input/time | P07 | S060 |  |
| FIELD-081 | {"slot": "4"} | input/time | P07 | S060 |  |
| FIELD-082 | {"slot": "5"} | input/time | P07 | S060 |  |
| FIELD-083 | {"slot": "6"} | input/time | P07 | S060 |  |
| FIELD-084 | {"slot": "7"} | input/time | P07 | S060 |  |
| FIELD-085 | {"slot": "8"} | input/time | P07 | S060 |  |
| FIELD-086 | {"slot": "9"} | input/time | P07 | S060 |  |
| FIELD-087 | {"slot": "10"} | input/time | P07 | S060 |  |
| FIELD-088 | {"slot": "11"} | input/time | P07 | S060 |  |
| FIELD-089 | {"slot": "12"} | input/time | P07 | S060 |  |
| FIELD-090 | {"slot": "13"} | input/time | P07 | S060 |  |
| FIELD-091 | {"slot": "14"} | input/time | P07 | S060 |  |
| FIELD-092 | {"slot": "15"} | input/time | P07 | S060 |  |
| FIELD-093 | {"slot": "16"} | input/time | P07 | S060 |  |
| FIELD-094 | {"slot": "17"} | input/time | P07 | S060 |  |
| FIELD-095 | {"slot": "18"} | input/time | P07 | S060 |  |
| FIELD-096 | {"slot": "19"} | input/time | P07 | S060 |  |
| FIELD-097 | {"slot": "20"} | input/time | P07 | S060 |  |
| FIELD-098 | {"slot": "21"} | input/time | P07 | S060 |  |
| FIELD-099 | {"slot": "22"} | input/time | P07 | S060 |  |
| FIELD-100 | {"slot": "23"} | input/time | P07 | S060 |  |
| FIELD-101 | {"processExtra": "*"} | input/text | P06 | S051, S058 |  |
| FIELD-102 | {} | input/text | P06 | S051, S058 |  |
| FIELD-103 | {} | input/text | P06 | S051, S058 |  |
| FIELD-104 | {} | input/text | P06 | S051, S058 |  |
| FIELD-105 | {} | input/number | P06 | S051, S058 |  |
| FIELD-106 | {} | input/checkbox | P06 | S051, S058 |  |
| FIELD-107 | {} | input/text | P06 | S051, S058 |  |
| FIELD-108 | {} | input/text | P06 | S051, S058 |  |
| FIELD-109 | {} | input/text | P06 | S051, S058 |  |
| FIELD-110 | {} | input/text | P06 | S051, S058 |  |
