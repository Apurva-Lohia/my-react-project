from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware  # Enables CORS
from pydantic import BaseModel
from dotenv import load_dotenv
from pymongo import MongoClient
import os
import google.generativeai as gen_ai
import re
from typing import Optional

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    raise Exception("Google API key is missing! Make sure it's set in your .env file.")

# Configure Google GenAI
gen_ai.configure(api_key=GOOGLE_API_KEY)
generation_config = {
    "temperature": 1.0,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 8192,
}
llm = gen_ai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config=generation_config,
)

chat_session = llm.start_chat(history=[])

# MongoDB setup
client = MongoClient("mongodb://localhost:27017/")
db = client.course_db
courses_collection = db.courses

# Pydantic model for request data
class RequestData(BaseModel):
    input: str
    course_id: str 
    user_answer : Optional[str] = None

def extract_course_details(text):
    # Define regex patterns for each detail
    course_name_pattern = r"Course Name:\s*(.+)"
    course_description_pattern = r"Course Description:\s*(.+)"
    time_to_complete_pattern = r"Time to complete\(in hours\):\s*(\d+)"
    chapters_pattern = r"Chapters:\n((?:\d+\.\s+.+\n?)*)"

    # Extract each detail using regex
    course_name = re.search(course_name_pattern, text)
    course_description = re.search(course_description_pattern, text)
    time_to_complete = re.search(time_to_complete_pattern, text)
    chapters = re.search(chapters_pattern, text)

    # Format the chapters into a list
    if chapters:
        chapters_list = chapters.group(1).strip().split('\n')
        # Remove empty entries and split chapters correctly
        chapters_list = [chapter.split('. ', 1)[1] for chapter in chapters_list if chapter.strip()]
    else:
        chapters_list = []

    # Create a dictionary with the extracted details
    course_details = {
        "title": course_name.group(1) if course_name else "",
        "description": course_description.group(1) if course_description else "",
        "duration": int(time_to_complete.group(1)) if time_to_complete else 0,
        "chapters": chapters_list,
    }

    return course_details

# Routes for course generation
@app.post("/generate_course")
async def generate_course(data: RequestData):
    prompt = f"""Create a course outline for '{data.input}'
                For Chapters, give only chapter names, not the sub-chapter names
                        
                Use this Output Format:
                        
                Course Name: <Fancy Course Name>
                Course Description: <Course Description>
                Time to complete(in hours): <duration>
                Chapters: <Chapter names in numbered list format>"""

    try:
        response = chat_session.send_message(prompt)
        course_details = extract_course_details(response.text)
        
        # Save the course details to the database
        courses_collection.insert_one({
                                        "course_id": data.course_id,
                                        "course_name": data.input, 
                                        "content": course_details
                                        })

        return {"course_details" : course_details}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
def parse_modules(text):
    # Define a regex pattern to match each topic
    pattern = r"\d+\.\s+.+"

    # Find all matches in the response
    matches = re.findall(pattern, text)
   
    return matches

@app.post("/generate_modules")
async def generate_modules(data: RequestData):
    prompt = f"""You will only generate common sub chapters names in list for {data.input}
                (course id: {data.course_id})
                output format:
                <numbered list of sub chapter name>
                
                example: 
                1. Data types and Variables
                2. Functions
                3. Promises
            """
    
    try:
        response = chat_session.send_message(prompt)
        module_details = parse_modules(response.text)

        courses_collection.update_one(
                                        {"course_id": data.course_id},
                                        {"$set": {"modules." + data.input: module_details}}
                                    )
    
        return {"module_details": module_details}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
def format_material(material):
    # Format headings (e.g., #, ##, ###) into HTML <h1>, <h2>, <h3>, etc.
    material = re.sub(r"(?m)^# (.*?)$", r"<h1>\1</h1>", material)
    material = re.sub(r"(?m)^## (.*?)$", r"<h2>\1</h2>", material)
    material = re.sub(r"(?m)^### (.*?)$", r"<h3>\1</h3>", material)

    # Format bullet points and numbered lists into <ul><li>...</li></ul>
    material = re.sub(r"(?m)^\* (.*?)$", r"<li>\1</li>", material)  # Match unordered list items
    material = re.sub(r"(?m)^\d+\.(.*?)$", r"<li>\1</li>", material)  # Match ordered list items
    material = re.sub(r"(<li>.*?</li>)+", r"<ul>\g<0></ul>", material)  # Wrap consecutive <li> in <ul>

    # Format bold text (**text**) into <strong>text</strong>
    material = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", material)

    # Format italicized text (*text*) into <em>text</em>
    material = re.sub(r"\*(.*?)\*", r"<em>\1</em>", material)

    # Format inline code (`code`) into <code>code</code>
    material = re.sub(r"`(.*?)`", r"<code>\1</code>", material)

    # Format code blocks (``` ... ```) into <pre><code>...</code></pre>
    material = re.sub(r"```(.*?)```", r"<pre><code>\1</code></pre>", material, flags=re.DOTALL)

    # Replace newlines with <br> for regular text paragraphs, while avoiding adding <br> between lists
    material = re.sub(r"(?<!</li>)\n(?!<ul>)", r"<br>", material)

    return material

@app.post("/generate_material")
async def generate_material(data: RequestData):
    """Generates material for a module specified by the user"""
    if not data.input:
        raise HTTPException(status_code=400, detail="Input is required")

    material_prompt = f"""
    You will only generate detailed markdown reading material for the module 
    {data.input} as text paragraph with numbered bullet points for the chapter 
    in a given course and if the topic is programming/coding related or a programming 
    language, provide code examples in the format of code blocks with syntax highlighting.

    example:
    heading
    sub-heading
    material 
    """

    try:
        response = chat_session.send_message(material_prompt)
        response = format_material(response.text)
        return {"message" : response}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate_summary")
async def generate_summary(data: RequestData):
    prompt = f"""Summarize the following reading material: {data.input}"""

    try:
        response = chat_session.send_message(prompt)
        return {"message": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate_example")
async def generate_example(data: RequestData):
    prompt = f"""Generate an example for the following material (coding examples 
    if programming related): {data.input}
    """

    try:
        response = chat_session.send_message(prompt)
        return {"message": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
def format_MCQ(MCQ):
    
    MCQs = []

    chunk_pattern = r'\*\*\d+\.\sQuestion:\*\*.*?(?=\n\*\*\d+\.\sQuestion:\*\*|\Z)'
    MCQ_chunk = re.findall(chunk_pattern, MCQ, re.DOTALL)

    for mcq in MCQ_chunk:
        print(mcq)

    MCQ_pattern = re.compile(r"""
                            \*\*\d+\.\sQuestion:\*\*\s*(?P<question>.*?)\sOptions:\s
                            \s*1\.\s*(?P<option1>.*?)\s
                            \s*2\.\s*(?P<option2>.*?)\s
                            \s*3\.\s*(?P<option3>.*?)\s
                            \s*4\.\s*(?P<option4>.*?)\s
                            Correct\s*Answer:\s*\d+\.\s*(?P<answer_text>.*)
                        """, re.VERBOSE | re.DOTALL)
        
    for MCQ in MCQ_chunk:
        match = MCQ_pattern.search(MCQ)

        if match:
            extracted_data = {
                        "question": match.group('question').strip(),
                        "options": [
                            match.group('option1').strip(),
                            match.group('option2').strip(),
                            match.group('option3').strip(),
                            match.group('option4').strip(),
                        ],
                        "answer": match.group('answer_text').strip()
                    }

            MCQs.append(extracted_data)
    
    return MCQs

# def format_MCQ(MCQ_raw):
#     # First, split into individual question blocks using a refined pattern
#     question_blocks = re.findall(r'\*\*\d+\. Question:\*\*.*?(?=\n\*\*\d+\. Question:\*\*|\Z)', MCQ_raw, re.DOTALL)
    
#     for question in question_blocks:
#         print(question)

#     questions = []
    
#     # Define the pattern to extract question, options, and answer
#     pattern = re.compile(r"""
#         \*\*\d+\. Question:\*\*\s*(?P<question>.*?)\n\s*\*\*Options:\*\*\s*\n
#         \s*1\.\s*(?P<option1>.*?)\n
#         \s*2\.\s*(?P<option2>.*?)\n
#         \s*3\.\s*(?P<option3>.*?)\n
#         \s*4\.\s*(?P<option4>.*?)\n
#         \s*\*\*Correct Answer:\*\*\s*\d+\.\s*(?P<answer_text>.*)
#     """, re.VERBOSE | re.DOTALL)

#     for block in question_blocks:
#         match = pattern.search(block)
#         print(match)
#         if match:
#             extracted_data = {
#                 "question": match.group('question').strip(),
#                 "options": [
#                     match.group('option1').strip(),
#                     match.group('option2').strip(),
#                     match.group('option3').strip(),
#                     match.group('option4').strip(),
#                 ],
#                 "answer": match.group('answer_text').strip()
#             }
#             questions.append(extracted_data)
    
#     return questions

@app.post("/generate_mcq")
async def generate_mcq(data: RequestData):
    prompt = f"""Generate 10 unique MCQ questions on {data.input} and ensure 
    the questions are clear, concise, and cover a specific topic. Provide four 
    distinct options for answers, with only one correct answer clearly indicated.
    Do not include topic name.

    Example format:
                
    Question: What is the capital of France?
    Options:
    1. Berlin
    2. Madrid
    3. Paris
    4. Rome
    Correct Answer: 3. Paris"""

    try:
        response = chat_session.send_message(prompt)
        formatted_response = format_MCQ(response.text)
        return {"mcqs": formatted_response}
        # return {"mcqs": response.text}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/clarify_doubt")
async def clarify_doubt(data: RequestData):
    prompt = f"""Clarify my doubt: {data.input}"""

    try:
        response = chat_session.send_message(prompt)
        return {"message": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def format_analysis(response):
    
    analysis = []
    # First pattern: Divide the whole response into individual question chunks.
    chunk_pattern = r'\*\*Question \d+:.*?(?=\n\*\*Question \d+:|\Z)'  
    question_chunk = re.findall(chunk_pattern, response, re.DOTALL)

    # Second pattern: Extract details from each question chunk.
    analysis_pattern = re.compile(r"""
                            \*\*Question\s*(?P<question_number>\d+):\s*(?P<question>.*?)
                            \*\s\*\*Options:\*\*\s*
                            1\.\s*(?P<option1>.*?)\s
                            2\.\s*(?P<option2>.*?)\s
                            3\.\s*(?P<option3>.*?)\s
                            4\.\s*(?P<option4>.*?)
                            \*\s\*\*Selected\s*Answer:\*\*\s*(?P<selected_answer>.*?)
                            \*\s\*\*Correct\s*Answer:\*\*\s*(?P<correct_answer>.*?)
                            \*\s\*\*Explanation:\*\*\s*(?P<explanation>.*?)\n+
                        """, re.VERBOSE | re.DOTALL)

    for question in question_chunk:
        match = analysis_pattern.search(question)
        
        if match:
            extracted_data = {
                "question_number": match.group('question_number').strip(),
                "question": match.group('question').strip(),
                "options": [
                    match.group('option1').strip(),
                    match.group('option2').strip(),
                    match.group('option3').strip(),
                    match.group('option4').strip(),
                ],
                "selected_answer": match.group('selected_answer').strip(),
                "correct_answer": match.group('correct_answer').strip(),
                "explanation": match.group('explanation').strip()
            }
            
            analysis.append(extracted_data)
    
    return analysis

@app.post("/analyze_content")
async def analyze_content(data: RequestData):
    
    questions = data.input
    answers = data.user_answer
        
    prompt = f""" f"Please review my answers={answers} against the questions={questions} 
    and give me detailed analysis with question, options, selected answer, correct answer, 
    and explaination. without giving intro" """
        

    try:
        response = chat_session.send_message(prompt)
        formatted_analysis = format_analysis(response.text)
        return {"message": formatted_analysis}
        # return {"message": response.text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
