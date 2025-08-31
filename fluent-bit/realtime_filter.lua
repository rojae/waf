function classify_event(tag, timestamp, record)
    if type(record) ~= "table" then
        return 1, timestamp, record
    end
    if type(record.transaction) ~= "table" then
        return 1, timestamp, record
    end

    -- 공통 메타데이터 추가
    local base_meta = {
        anomaly_score = 0,
        rule_id = nil,
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ", os.time())
    }

    -- realtime 이벤트 복제본
    local realtime_record = {}
    for k,v in pairs(record) do realtime_record[k] = v end
    realtime_record.classification = {}
    for k,v in pairs(base_meta) do realtime_record.classification[k] = v end
    realtime_record.classification.track = "realtime"

    -- analytics 이벤트 복제본
    local analytics_record = {}
    for k,v in pairs(record) do analytics_record[k] = v end
    analytics_record.classification = {}
    for k,v in pairs(base_meta) do analytics_record.classification[k] = v end
    analytics_record.classification.track = "analytics"

    -- 각각 다른 태그로 반환 (Kafka Output 매칭 가능)
    return 3,
        timestamp, "waf.modsec.realtime", realtime_record,
        timestamp, "waf.modsec.analytics", analytics_record
end

------------------------------------------------------
-- It's use for debugging, development
------------------------------------------------------
-- function dump_table(t, indent)
--     if not indent then indent = "" end
--     if type(t) ~= "table" then
--         print(indent .. tostring(t))
--         return
--     end
--     for k,v in pairs(t) do
--         if type(v) == "table" then
--             print(indent .. tostring(k) .. " => table")
--             dump_table(v, indent .. "  ")
--         else
--             print(indent .. tostring(k) .. " => " .. tostring(v))
--         end
--     end
-- end

-- function classify_event(tag, timestamp, record)
--     print("=== DEBUG RECORD START ===")
--     print("tag: " .. tostring(tag))
--     print("timestamp: " .. tostring(timestamp))
--     dump_table(record, "  ")
--     print("=== DEBUG RECORD END ===")

--     -- 일단 그냥 그대로 통과시키기
--     return 1, timestamp, record
-- end