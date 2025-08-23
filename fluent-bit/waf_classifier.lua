-- WAF Event Classification Script
-- Classifies events into analytics vs realtime tracks based on anomaly score and rule patterns

function classify_waf_event(tag, timestamp, record)
    -- Initialize classification structure
    local classification = {}
    local track = "analytics"  -- Default track
    local anomaly_score = 0
    local rule_id = ""
    
    -- Extract anomaly score from transaction
    if record.transaction then
        if record.transaction.anomaly_score then
            anomaly_score = record.transaction.anomaly_score
        end
        
        -- Extract primary rule ID from messages
        if record.transaction.messages and type(record.transaction.messages) == "table" then
            for i, message in ipairs(record.transaction.messages) do
                if message.details and message.details.ruleId then
                    if rule_id == "" then
                        rule_id = message.details.ruleId  -- Use first rule ID
                    end
                    
                    -- Critical rules trigger realtime track
                    local rule_str = tostring(message.details.ruleId)
                    if rule_str:match("^942") or  -- SQLi
                       rule_str:match("^941") or  -- XSS  
                       rule_str:match("^932") or  -- RCE
                       rule_str:match("^949") then -- Blocking evaluation
                        track = "realtime"
                    end
                end
            end
        end
    end
    
    -- High anomaly scores trigger realtime track
    if anomaly_score >= 20 then
        track = "realtime"
    end
    
    -- Scanner detection (rule 913xxx) stays in analytics for noise reduction
    if rule_id ~= "" and tostring(rule_id):match("^913") then
        track = "analytics"
    end
    
    -- Build classification object
    classification.track = track
    classification.anomaly_score = anomaly_score
    classification.rule_id = rule_id
    classification.timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
    
    -- Add classification to record
    record.classification = classification
    
    return 1, timestamp, record
end