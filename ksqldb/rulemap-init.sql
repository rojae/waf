-- =========================
-- IP REPUTATION (REQUEST-910)
-- =========================
INSERT INTO RULEMAP VALUES ('910000','ip-reputation','CRITICAL'); -- Known malicious client
INSERT INTO RULEMAP VALUES ('910100','ip-reputation','CRITICAL'); -- High risk country
INSERT INTO RULEMAP VALUES ('910150','ip-reputation','CRITICAL'); -- Search engine blacklist
INSERT INTO RULEMAP VALUES ('910160','ip-reputation','CRITICAL'); -- Spammer IP
INSERT INTO RULEMAP VALUES ('910170','ip-reputation','CRITICAL'); -- Suspicious IP
INSERT INTO RULEMAP VALUES ('910180','ip-reputation','CRITICAL'); -- Harvester IP

-- =========================
-- METHOD ENFORCEMENT (REQUEST-911)
-- =========================
INSERT INTO RULEMAP VALUES ('911100','method-enforcement','CRITICAL'); -- Method not allowed

-- =========================
-- DoS PROTECTION (REQUEST-912)
-- =========================
INSERT INTO RULEMAP VALUES ('912120','dos-attack','NOTICE');  -- DoS identified (counter)
INSERT INTO RULEMAP VALUES ('912170','dos-attack','NOTICE');  -- Potential DoS (bursts)
INSERT INTO RULEMAP VALUES ('912171','dos-attack','NOTICE');  -- Potential DoS (bursts, PL2)

-- =========================
-- SCANNER DETECTION (REQUEST-913)
-- =========================
INSERT INTO RULEMAP VALUES ('913100','scanner-detection','CRITICAL'); -- Scanner UA
INSERT INTO RULEMAP VALUES ('913101','scanner-detection','CRITICAL'); -- Generic client / scripting UA (PL2)
INSERT INTO RULEMAP VALUES ('913102','scanner-detection','CRITICAL'); -- Crawler / bot (PL2)
INSERT INTO RULEMAP VALUES ('913110','scanner-detection','CRITICAL'); -- Scanner header
INSERT INTO RULEMAP VALUES ('913120','scanner-detection','CRITICAL'); -- Scanner filename/arg

-- =========================
-- PROTOCOL ENFORCEMENT (REQUEST-920)
-- =========================
INSERT INTO RULEMAP VALUES ('920100','protocol-enforcement','NOTICE');   -- Invalid request line
INSERT INTO RULEMAP VALUES ('920120','protocol-enforcement','CRITICAL'); -- multipart bypass
INSERT INTO RULEMAP VALUES ('920130','protocol-enforcement','CRITICAL'); -- failed to parse body
INSERT INTO RULEMAP VALUES ('920140','protocol-enforcement','CRITICAL'); -- multipart strict validation fail
INSERT INTO RULEMAP VALUES ('920160','protocol-enforcement','CRITICAL'); -- Content-Length not numeric
INSERT INTO RULEMAP VALUES ('920170','protocol-enforcement','CRITICAL'); -- GET/HEAD with body
INSERT INTO RULEMAP VALUES ('920180','protocol-enforcement','NOTICE');   -- POST missing Content-Length
INSERT INTO RULEMAP VALUES ('920190','protocol-enforcement','WARNING');  -- Range: invalid last byte
INSERT INTO RULEMAP VALUES ('920200','protocol-enforcement','WARNING');  -- Too many fields
INSERT INTO RULEMAP VALUES ('920201','protocol-enforcement','WARNING');  -- Too many fields (pdf, PL2)
INSERT INTO RULEMAP VALUES ('920202','protocol-enforcement','WARNING');  -- Too many fields (pdf, PL4)
INSERT INTO RULEMAP VALUES ('920210','protocol-enforcement','WARNING');  -- Conflicting Connection headers
INSERT INTO RULEMAP VALUES ('920220','protocol-enforcement','WARNING');  -- URL encoding abuse
INSERT INTO RULEMAP VALUES ('920230','protocol-enforcement','WARNING');  -- Multiple URL encoding (PL2)
INSERT INTO RULEMAP VALUES ('920240','protocol-enforcement','WARNING');  -- URL encoding abuse
INSERT INTO RULEMAP VALUES ('920250','protocol-enforcement','WARNING');  -- UTF8 abuse
INSERT INTO RULEMAP VALUES ('920260','protocol-enforcement','WARNING');  -- Unicode width abuse
INSERT INTO RULEMAP VALUES ('920270','protocol-enforcement','ERROR');    -- Null char in request
INSERT INTO RULEMAP VALUES ('920271','protocol-enforcement','CRITICAL'); -- Non-printable chars (PL2)
INSERT INTO RULEMAP VALUES ('920272','protocol-enforcement','CRITICAL'); -- Outside printable <127 (PL3)
INSERT INTO RULEMAP VALUES ('920273','protocol-enforcement','CRITICAL'); -- Very strict set (PL4)
INSERT INTO RULEMAP VALUES ('920274','protocol-enforcement','CRITICAL'); -- Invalid chars in headers (PL4)
INSERT INTO RULEMAP VALUES ('920280','protocol-enforcement','WARNING');  -- Missing Host header
INSERT INTO RULEMAP VALUES ('920290','protocol-enforcement','WARNING');  -- Empty Host header
INSERT INTO RULEMAP VALUES ('920300','protocol-enforcement','NOTICE');   -- Missing Accept header (PL2)
INSERT INTO RULEMAP VALUES ('920310','protocol-enforcement','NOTICE');   -- Empty Accept header
INSERT INTO RULEMAP VALUES ('920311','protocol-enforcement','NOTICE');   -- Empty Accept header
INSERT INTO RULEMAP VALUES ('920320','protocol-enforcement','NOTICE');   -- Missing User-Agent (PL2)
INSERT INTO RULEMAP VALUES ('920330','protocol-enforcement','NOTICE');   -- Empty User-Agent
INSERT INTO RULEMAP VALUES ('920340','protocol-enforcement','NOTICE');   -- Content present, missing Content-Type
INSERT INTO RULEMAP VALUES ('920350','protocol-enforcement','WARNING');  -- Host is numeric IP
INSERT INTO RULEMAP VALUES ('920360','protocol-enforcement','CRITICAL'); -- Arg name too long
INSERT INTO RULEMAP VALUES ('920370','protocol-enforcement','CRITICAL'); -- Arg value too long
INSERT INTO RULEMAP VALUES ('920380','protocol-enforcement','CRITICAL'); -- Too many arguments
INSERT INTO RULEMAP VALUES ('920390','protocol-enforcement','CRITICAL'); -- Total args size exceeded
INSERT INTO RULEMAP VALUES ('920400','protocol-enforcement','CRITICAL'); -- Uploaded file too large
INSERT INTO RULEMAP VALUES ('920410','protocol-enforcement','CRITICAL'); -- Total uploaded files too large
INSERT INTO RULEMAP VALUES ('920420','protocol-enforcement','CRITICAL'); -- Content-Type not allowed
INSERT INTO RULEMAP VALUES ('920430','protocol-enforcement','CRITICAL'); -- HTTP version not allowed
INSERT INTO RULEMAP VALUES ('920440','protocol-enforcement','CRITICAL'); -- URL file ext restricted
INSERT INTO RULEMAP VALUES ('920450','protocol-enforcement','CRITICAL'); -- Header restricted by policy
INSERT INTO RULEMAP VALUES ('920460','protocol-enforcement','CRITICAL'); -- Abnormal escape detected (PL4)

-- =========================
-- PROTOCOL ATTACK (REQUEST-921)
-- =========================
INSERT INTO RULEMAP VALUES ('921100','protocol-attack','CRITICAL'); -- Request smuggling
INSERT INTO RULEMAP VALUES ('921110','protocol-attack','CRITICAL'); -- Request smuggling
INSERT INTO RULEMAP VALUES ('921120','protocol-attack','CRITICAL'); -- Response splitting
INSERT INTO RULEMAP VALUES ('921130','protocol-attack','CRITICAL'); -- Response splitting
INSERT INTO RULEMAP VALUES ('921140','protocol-attack','CRITICAL'); -- Header injection via headers
INSERT INTO RULEMAP VALUES ('921150','protocol-attack','CRITICAL'); -- Header injection via payload
INSERT INTO RULEMAP VALUES ('921151','protocol-attack','CRITICAL'); -- Header injection via payload (PL2)
INSERT INTO RULEMAP VALUES ('921160','protocol-attack','CRITICAL'); -- Header injection via payload (hdr-name)
INSERT INTO RULEMAP VALUES ('921180','protocol-attack','CRITICAL'); -- HTTP parameter pollution

-- =========================
-- LFI / PATH TRAVERSAL (REQUEST-930)
-- =========================
INSERT INTO RULEMAP VALUES ('930100','attack-lfi','CRITICAL'); -- ../ traversal
INSERT INTO RULEMAP VALUES ('930110','attack-lfi','CRITICAL');
INSERT INTO RULEMAP VALUES ('930120','attack-lfi','CRITICAL'); -- OS file access
INSERT INTO RULEMAP VALUES ('930130','attack-lfi','CRITICAL'); -- restricted file

-- =========================
-- RFI (REQUEST-931)
-- =========================
INSERT INTO RULEMAP VALUES ('931100','attack-rfi','CRITICAL'); -- URL + IP
INSERT INTO RULEMAP VALUES ('931110','attack-rfi','CRITICAL'); -- common param names
INSERT INTO RULEMAP VALUES ('931120','attack-rfi','CRITICAL'); -- trailing ?
INSERT INTO RULEMAP VALUES ('931130','attack-rfi','CRITICAL'); -- off-domain link (PL2)

-- =========================
-- RCE (REQUEST-932)
-- =========================
INSERT INTO RULEMAP VALUES ('932100','attack-rce','CRITICAL'); -- Unix cmd injection
INSERT INTO RULEMAP VALUES ('932105','attack-rce','CRITICAL');
INSERT INTO RULEMAP VALUES ('932110','attack-rce','CRITICAL'); -- Windows cmd
INSERT INTO RULEMAP VALUES ('932115','attack-rce','CRITICAL');
INSERT INTO RULEMAP VALUES ('932120','attack-rce','CRITICAL'); -- PowerShell
INSERT INTO RULEMAP VALUES ('932130','attack-rce','CRITICAL'); -- Shell expr
INSERT INTO RULEMAP VALUES ('932140','attack-rce','CRITICAL'); -- Windows FOR/IF
INSERT INTO RULEMAP VALUES ('932150','attack-rce','CRITICAL'); -- Direct Unix exec
INSERT INTO RULEMAP VALUES ('932160','attack-rce','CRITICAL'); -- Unix shellcode
INSERT INTO RULEMAP VALUES ('932170','attack-rce','CRITICAL'); -- Shellshock
INSERT INTO RULEMAP VALUES ('932171','attack-rce','CRITICAL'); -- Shellshock variant

-- =========================
-- PHP INJECTION (REQUEST-933)
-- =========================
INSERT INTO RULEMAP VALUES ('933100','attack-php','CRITICAL'); -- <?php
INSERT INTO RULEMAP VALUES ('933110','attack-php','CRITICAL'); -- PHP upload
INSERT INTO RULEMAP VALUES ('933111','attack-php','CRITICAL'); -- PHP upload (PL3)
INSERT INTO RULEMAP VALUES ('933120','attack-php','CRITICAL'); -- config directive
INSERT INTO RULEMAP VALUES ('933130','attack-php','CRITICAL'); -- variables
INSERT INTO RULEMAP VALUES ('933131','attack-php','CRITICAL'); -- variables (PL3)
INSERT INTO RULEMAP VALUES ('933140','attack-php','CRITICAL'); -- streams
INSERT INTO RULEMAP VALUES ('933150','attack-php','CRITICAL'); -- high-risk function
INSERT INTO RULEMAP VALUES ('933151','attack-php','CRITICAL'); -- medium-risk function (PL2)
INSERT INTO RULEMAP VALUES ('933160','attack-php','CRITICAL'); -- high-risk call
INSERT INTO RULEMAP VALUES ('933161','attack-php','CRITICAL'); -- low-value call (PL3)
INSERT INTO RULEMAP VALUES ('933170','attack-php','CRITICAL'); -- serialized object
INSERT INTO RULEMAP VALUES ('933180','attack-php','CRITICAL'); -- variable func call

-- =========================
-- XSS (REQUEST-941)
-- =========================
INSERT INTO RULEMAP VALUES ('941100','attack-xss','CRITICAL'); -- libinjection XSS
INSERT INTO RULEMAP VALUES ('941110','attack-xss','CRITICAL'); -- Cat 1: script tag
INSERT INTO RULEMAP VALUES ('941120','attack-xss','CRITICAL'); -- Cat 2: event handler
INSERT INTO RULEMAP VALUES ('941130','attack-xss','CRITICAL'); -- Cat 3: attribute
INSERT INTO RULEMAP VALUES ('941140','attack-xss','CRITICAL'); -- Cat 4: javascript: URI
INSERT INTO RULEMAP VALUES ('941150','attack-xss','CRITICAL'); -- Cat 5: disallowed attrs
INSERT INTO RULEMAP VALUES ('941160','attack-xss','CRITICAL'); -- NoScript HTML injection
INSERT INTO RULEMAP VALUES ('941170','attack-xss','CRITICAL'); -- NoScript attribute injection
INSERT INTO RULEMAP VALUES ('941180','attack-xss','CRITICAL'); -- Node-Validator blacklist
INSERT INTO RULEMAP VALUES ('941190','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941200','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941210','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941220','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941230','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941240','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941250','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941260','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941270','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941280','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941290','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941300','attack-xss','CRITICAL'); -- IE XSS filter detected
INSERT INTO RULEMAP VALUES ('941310','attack-xss','CRITICAL'); -- US-ASCII malformed encoding
INSERT INTO RULEMAP VALUES ('941320','attack-xss','CRITICAL'); -- Possible XSS - HTML tag handler (PL2)
INSERT INTO RULEMAP VALUES ('941330','attack-xss','CRITICAL'); -- IE XSS filter detected (PL2)
INSERT INTO RULEMAP VALUES ('941340','attack-xss','CRITICAL'); -- IE XSS filter detected (PL2)
INSERT INTO RULEMAP VALUES ('941350','attack-xss','CRITICAL'); -- UTF-7 Encoding IE XSS

-- =========================
-- SQLi (REQUEST-942)
-- =========================
INSERT INTO RULEMAP VALUES ('942100','attack-sqli','CRITICAL'); -- libinjection SQLi
INSERT INTO RULEMAP VALUES ('942110','attack-sqli','WARNING');  -- common injection testing (PL2)
INSERT INTO RULEMAP VALUES ('942120','attack-sqli','CRITICAL'); -- SQL operator detected (PL2)
INSERT INTO RULEMAP VALUES ('942130','attack-sqli','CRITICAL'); -- SQL tautology
INSERT INTO RULEMAP VALUES ('942140','attack-sqli','CRITICAL'); -- common DB names
INSERT INTO RULEMAP VALUES ('942150','attack-sqli','CRITICAL'); -- SQLi generic
INSERT INTO RULEMAP VALUES ('942160','attack-sqli','CRITICAL'); -- blind via sleep/benchmark
INSERT INTO RULEMAP VALUES ('942170','attack-sqli','CRITICAL'); -- benchmark/sleep incl. conditional

-- =========================
-- NODE.JS (REQUEST-934)
-- =========================
INSERT INTO RULEMAP VALUES ('934100','attack-nodejs','CRITICAL');  -- Node.js Injection Attack

-- =========================
-- SESSION FIXATION (REQUEST-943)
-- =========================
INSERT INTO RULEMAP VALUES ('943100','session-fixation','CRITICAL'); -- Setting cookie values in HTML
INSERT INTO RULEMAP VALUES ('943110','session-fixation','CRITICAL'); -- SessionID param with off-domain referer
INSERT INTO RULEMAP VALUES ('943120','session-fixation','CRITICAL'); -- SessionID param with no referer

-- =========================
-- JAVA (REQUEST-944)
-- =========================
INSERT INTO RULEMAP VALUES ('944100','attack-java','CRITICAL');  -- RCE: Struts/WebLogic 등
INSERT INTO RULEMAP VALUES ('944110','attack-java','CRITICAL');  -- Potential payload execution
INSERT INTO RULEMAP VALUES ('944120','attack-java','CRITICAL');  -- Possible payload/RCE
INSERT INTO RULEMAP VALUES ('944130','attack-java','CRITICAL');  -- Suspicious Java classes
INSERT INTO RULEMAP VALUES ('944200','attack-java','CRITICAL');  -- Java deserialization (Commons)
INSERT INTO RULEMAP VALUES ('944210','attack-java','CRITICAL');  -- Possible Java serialization use

-- =========================
-- BLOCKING EVALUATION (REQUEST-949)
-- =========================
-- Inbound anomaly score가 임계치 초과 시 실제 차단을 수행하는 스위치 룰.
INSERT INTO RULEMAP VALUES ('949110','blocking-evaluation','CRITICAL'); -- Inbound Anomaly Score Exceeded