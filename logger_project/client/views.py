from django.shortcuts import render, HttpResponse

def landing(request):
    return render(request, 'client/landing.html')