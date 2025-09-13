
from decimal import Decimal
import os
import json
from uuid import uuid4
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
import logging


logger = logging.getLogger()
logger.setLevel(logging.INFO)

comprehend = boto3.client("comprehend")
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    logger.info(f"Incoming event: {event}")

    table_name = os.environ.get('TABLE_NAME')
    if not table_name:
        logger.error("TABLE_NAME environment variable not set.")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Configuration error: Missing table name"})
        }

    table = dynamodb.Table(table_name)
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Content-Type": "application/json"
    }
    try:
        body = json.loads(event.get("body", "{}"))
        review = body.get("content", "").strip()
    except Exception as e:
        logger.error(f"Error parsing input: {e}")
        return {
            "statusCode": 400,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({"error": "Invalid JSON input"})
        }
    
    try:
        body = json.loads(event.get("body", "{}"))
        content = body.get("content", "").strip()
        author = body.get("author", "anonymous").strip()
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing JSON input: {e}")
        return { "statusCode": 400, "headers": headers, "body": json.dumps({"error": "Invalid JSON input"}) }

    if not review or len(review) < 300:
        return {
            "statusCode": 400,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({"error": "Review must be at least 300 characters long"})
        }

    try:
        """ response = client.detect_toxic_content(
            LanguageCode='en',
            TextSegments=[{'Text': '}]
        ) """
        response = {
            "ResultList": [ 
                { 
                    "Labels": [
                            {
                                "Name": "PROFANITY",
                                "Score": 0.0006000000284984708
                            },
                            {
                                "Name": "HATE_SPEECH",
                                "Score": 0.00930000003427267
                            },
                            {
                                "Name": "INSULT",
                                "Score": 0.9204999804496765
                            },
                            {
                                "Name": "GRAPHIC",
                                "Score": 9.999999747378752e-05
                            },
                            {
                                "Name": "HARASSMENT_OR_ABUSE",
                                "Score": 0.0052999998442828655
                            },
                            {
                                "Name": "SEXUAL",
                                "Score": 0.01549999974668026
                            },
                            {
                                "Name": "VIOLENCE_OR_THREAT",
                                "Score": 0.007799999788403511
                            }
                        ],
                        "Toxicity": 0.6192999720573425
                }
            ]
        }        
        logger.info(f"Comprehend response: {response}")


        toxicity_score = response['ResultList'][0]['Toxicity']

        if toxicity_score > 0.7:
            return {
                "statusCode": 400,
                "headers": headers,
                "body": json.dumps({"error": "Post content is too toxic and cannot be published."})
            }
        
        postId = str(uuid4())
        createdAt = datetime.now().isoformat()
        
        table.put_item(Item={
            'postId': postId,
            'createdAt': createdAt,
            'GSI_PK': 'posts',
            'content': content,
            'author': author,
            'toxicityScore': Decimal(str(toxicity_score)), # 💡 FIX: Convert the float to a Decimal before saving,
        })

        return {
            "statusCode": 201,
            "headers": headers,
            "body": json.dumps({"message": "Post created successfully", "postId": postId})
        }

    except ClientError as e:
        logger.error(f"AWS Client Error: {e.response['Error']['Message']}")
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": "Failed to analyze or save post", "message": e.response['Error']['Message']})
        }
    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}")
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": "An unexpected error occurred", "message": str(e)})
        }  
    except Exception as e:
        logger.error(f"Comprehend error: {e}")
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({"error": "Failed to analyze sentiment"})
        }
