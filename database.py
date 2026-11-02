import sqlite3
import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "waste_management.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        class_name TEXT NOT NULL,
        waste_type TEXT NOT NULL,
        bin_color TEXT NOT NULL,
        confidence REAL NOT NULL,
        co2_saved_g REAL DEFAULT 0.0
    );
    """)
    conn.commit()
    conn.close()

def log_detection(class_name: str, waste_type: str, bin_color: str, confidence: float, co2_saved_g: float = 0.0):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO detections (class_name, waste_type, bin_color, confidence, co2_saved_g)
        VALUES (?, ?, ?, ?, ?)
    """, (class_name, waste_type, bin_color, confidence, co2_saved_g))
    conn.commit()
    conn.close()

def get_stats():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Total count today
    cursor.execute("""
        SELECT COUNT(*) as total, COALESCE(SUM(co2_saved_g), 0) as total_co2
        FROM detections
        WHERE date(timestamp, 'localtime') = date('now', 'localtime')
    """)
    today_row = cursor.fetchone()
    total_today = today_row["total"] if today_row else 0
    total_co2_g = today_row["total_co2"] if today_row else 0.0

    # Counts by waste type today
    cursor.execute("""
        SELECT waste_type, bin_color, COUNT(*) as count
        FROM detections
        WHERE date(timestamp, 'localtime') = date('now', 'localtime')
        GROUP BY waste_type, bin_color
    """)
    type_counts = [dict(row) for row in cursor.fetchall()]

    # Hourly distribution today
    cursor.execute("""
        SELECT strftime('%H:00', timestamp, 'localtime') as hour, COUNT(*) as count
        FROM detections
        WHERE date(timestamp, 'localtime') = date('now', 'localtime')
        GROUP BY hour
        ORDER BY hour ASC
    """)
    hourly_counts = [dict(row) for row in cursor.fetchall()]

    # Recent 15 detections
    cursor.execute("""
        SELECT id, strftime('%H:%M:%S', timestamp, 'localtime') as time_str,
               class_name, waste_type, bin_color, confidence, co2_saved_g
        FROM detections
        ORDER BY id DESC
        LIMIT 15
    """)
    recent = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return {
        "total_today": total_today,
        "co2_saved_kg": round(total_co2_g / 1000.0, 3),
        "by_type": type_counts,
        "hourly": hourly_counts,
        "recent": recent
    }

def delete_detection(detection_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM detections WHERE id = ?", (detection_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    return rows_affected > 0

def reset_all_detections() -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM detections")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name = 'detections'")
    conn.commit()
    conn.close()
    return True

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DB_PATH)
